import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertScriptSchema, insertSettingsSchema } from "@shared/schema";
import { getDocContent, extractDocIdFromUrl, listRecentDocs } from "./google-docs";
import {
  verifySsoToken,
  authenticateClient,
  checkUsage,
  consumeUsage,
  getEntitlements,
  forgotPassword,
  resetPassword,
} from "./foco360";

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.client) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/auth/me", (req, res) => {
    if (!req.session.client) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    res.json({ client: req.session.client });
  });

  app.post("/api/auth/sso", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ message: "Token não fornecido" });
      }
      const result = await verifySsoToken(token);
      if (!result.success) {
        return res.status(401).json({ message: result.message || "Token inválido ou expirado" });
      }
      req.session.client = result.client;
      req.session.save((err) => {
        if (err) {
          console.error("Session save error (SSO):", err);
          return res.status(500).json({ message: "Erro ao salvar sessão" });
        }
        res.json({ success: true, client: result.client, usage: result.usage });
      });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ message: err.message || "Erro ao verificar SSO" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "E-mail e senha são obrigatórios" });
      }
      const result = await authenticateClient(email, password);
      if (!result.success) {
        return res.status(401).json({ message: result.message || "Credenciais inválidas" });
      }
      req.session.client = result.client;
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("Session save error (login):", saveErr);
          return res.status(500).json({ message: "Erro ao salvar sessão" });
        }
        res.json({ success: true, client: result.client, usage: result.usage });
      });
    } catch (err: any) {
      const status = err.status || 500;
      let message = err.message || "Erro ao autenticar";
      if (status === 429) {
        message = "Muitas tentativas de login. Aguarde 15 minutos e tente novamente.";
      } else if (status === 403) {
        message = "Sua conta não tem acesso a este produto. Entre em contato com o administrador do FOCO360.";
      } else if (status === 404) {
        message = "Conta não encontrada no FOCO360. Verifique o e-mail informado.";
      } else if (status === 401) {
        message = "E-mail ou senha incorretos.";
      }
      res.status(status).json({ message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao encerrar sessão" });
      }
      res.json({ success: true });
    });
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "E-mail é obrigatório" });
      }
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const resetUrl = `${protocol}://${host}`;
      const result = await forgotPassword(email, resetUrl);
      res.json({ success: true, message: "E-mail de recuperação enviado" });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ message: err.message || "Erro ao enviar e-mail" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token e nova senha são obrigatórios" });
      }
      const result = await resetPassword(token, newPassword);
      res.json({ success: true, message: "Senha redefinida com sucesso" });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ message: err.message || "Erro ao redefinir senha" });
    }
  });

  app.get("/api/usage/check", requireAuth, async (req, res) => {
    try {
      const result = await checkUsage(req.session.client!.email);
      res.json(result);
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ message: err.message || "Erro ao verificar uso" });
    }
  });

  app.post("/api/usage/consume", requireAuth, async (req, res) => {
    try {
      const { amount } = req.body;
      const result = await consumeUsage(req.session.client!.email, amount || 1);
      res.json(result);
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ message: err.message || "Erro ao consumir recurso" });
    }
  });

  app.get("/api/usage/entitlements", requireAuth, async (req, res) => {
    try {
      const result = await getEntitlements(req.session.client!.email);
      res.json(result);
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ message: err.message || "Erro ao buscar limites" });
    }
  });

  app.get("/api/scripts", requireAuth, async (_req, res) => {
    try {
      const scripts = await storage.getScripts();
      res.json(scripts);
    } catch (err) {
      res.status(500).json({ message: "Erro ao buscar scripts" });
    }
  });

  app.get("/api/scripts/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const script = await storage.getScript(id);
      if (!script) {
        return res.status(404).json({ message: "Script não encontrado" });
      }
      res.json(script);
    } catch (err) {
      res.status(500).json({ message: "Erro ao buscar script" });
    }
  });

  app.post("/api/scripts", requireAuth, async (req, res) => {
    try {
      const email = req.session.client!.email;
      const usageCheck = await checkUsage(email);
      if (!usageCheck.canCreate) {
        return res.status(403).json({
          message: "Limite de uso atingido. Entre em contato com o administrador.",
          usage: usageCheck.usage,
          limit: usageCheck.limit,
        });
      }

      const nextNumber = await storage.getNextNumber();
      const dataWithNumber = { ...req.body, number: nextNumber };
      const parsed = insertScriptSchema.safeParse(dataWithNumber);
      if (!parsed.success) {
        return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.errors });
      }
      const script = await storage.createScript(parsed.data);

      try {
        await consumeUsage(email, 1);
      } catch (consumeErr) {
        console.error("Erro ao consumir uso:", consumeErr);
      }

      res.status(201).json(script);
    } catch (err) {
      res.status(500).json({ message: "Erro ao criar script" });
    }
  });

  app.patch("/api/scripts/reorder", requireAuth, async (req, res) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ message: "Items inválidos" });
      }
      await Promise.all(
        items.map(({ id, number }: { id: number; number: number }) =>
          storage.updateScript(id, { number })
        )
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Erro ao reordenar scripts" });
    }
  });

  app.patch("/api/scripts/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getScript(id);
      if (!existing) {
        return res.status(404).json({ message: "Script não encontrado" });
      }
      const { title, content, fontSize, speed, mirrored, googleDocId } = req.body;
      const updateData: Record<string, any> = {};
      if (title !== undefined) updateData.title = title;
      if (content !== undefined) updateData.content = content;
      if (fontSize !== undefined) updateData.fontSize = fontSize;
      if (speed !== undefined) updateData.speed = speed;
      if (mirrored !== undefined) updateData.mirrored = mirrored;
      if (googleDocId !== undefined) updateData.googleDocId = googleDocId;
      const updated = await storage.updateScript(id, updateData);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Erro ao atualizar script" });
    }
  });

  app.delete("/api/scripts/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteScript(id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Erro ao remover script" });
    }
  });

  app.get("/api/settings", requireAuth, async (_req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings || { defaultFontSize: 48, defaultSpeed: 3, defaultMirrored: false, defaultMargin: 5 });
    } catch (err) {
      res.status(500).json({ message: "Erro ao buscar configurações" });
    }
  });

  app.post("/api/settings", requireAuth, async (req, res) => {
    try {
      const parsed = insertSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.errors });
      }
      const settings = await storage.upsertSettings(parsed.data);
      res.json(settings);
    } catch (err) {
      res.status(500).json({ message: "Erro ao salvar configurações" });
    }
  });

  app.get("/api/gdocs/list", requireAuth, async (_req, res) => {
    try {
      const docs = await listRecentDocs();
      res.json(docs);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Erro ao listar documentos" });
    }
  });

  app.post("/api/gdocs/import", requireAuth, async (req, res) => {
    try {
      const { url, docId } = req.body;
      let resolvedDocId = docId;
      if (url && !docId) {
        resolvedDocId = extractDocIdFromUrl(url);
      }
      if (!resolvedDocId) {
        return res.status(400).json({ message: "URL ou ID do documento inválido" });
      }
      console.log(`[gdocs] Importing doc: ${resolvedDocId}`);
      const doc = await getDocContent(resolvedDocId);
      console.log(`[gdocs] Import success: "${doc.title}"`);
      res.json({ ...doc, docId: resolvedDocId });
    } catch (err: any) {
      console.error(`[gdocs] Import error:`, err?.message || err);
      const msg = err?.message || "Erro ao importar documento";
      const status = err?.code === 404 || msg.includes("not found") ? 404 : 500;
      res.status(status).json({ message: msg });
    }
  });

  app.get("/api/gdocs/sync/:docId", requireAuth, async (req, res) => {
    try {
      const { docId } = req.params;
      const doc = await getDocContent(docId);
      res.set("Cache-Control", "no-store, no-cache, must-revalidate");
      res.set("Pragma", "no-cache");
      res.json(doc);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Erro ao sincronizar documento" });
    }
  });

  return httpServer;
}
