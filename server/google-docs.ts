import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken(forceRefresh = false) {
  if (!forceRefresh && connectionSettings && connectionSettings.settings?.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }

  connectionSettings = null;

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-docs',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Docs não está conectado. Reconecte a integração.');
  }
  return accessToken;
}

async function getUncachableGoogleDocsClient() {
  const accessToken = await getAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.docs({ version: 'v1', auth: oauth2Client });
}

async function getUncachableGoogleDocsClientRetry() {
  try {
    return await getUncachableGoogleDocsClient();
  } catch {
    const accessToken = await getAccessToken(true);
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.docs({ version: 'v1', auth: oauth2Client });
  }
}

function extractTextFromDoc(doc: any): string {
  const body = doc.data?.body;
  if (!body?.content) return '';

  const lines: string[] = [];

  for (const element of body.content) {
    if (element.paragraph) {
      const para = element.paragraph;
      let lineText = '';

      const bullet = para.bullet;
      if (bullet) {
        const level = bullet.nestingLevel || 0;
        const indent = '  '.repeat(level);
        lineText += indent + '• ';
      }

      for (const el of para.elements || []) {
        if (el.textRun?.content) {
          lineText += el.textRun.content;
        }
      }

      lineText = lineText.replace(/\n$/, '');
      lines.push(lineText);
    }
  }

  return lines.join('\n').trim();
}

export function extractDocIdFromUrl(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export async function getDocContent(documentId: string): Promise<{ title: string; content: string }> {
  const attempt = async (docs: any) => {
    const doc = await docs.documents.get({
      documentId,
      suggestionsViewMode: 'PREVIEW_WITHOUT_SUGGESTIONS',
    });
    const title = doc.data.title || 'Untitled';
    const content = extractTextFromDoc(doc);
    return { title, content };
  };

  try {
    const docs = await getUncachableGoogleDocsClient();
    return await attempt(docs);
  } catch (err: any) {
    const code = err?.code || err?.response?.status;
    if (code === 401 || code === 403 || err?.message?.includes('Insufficient') || err?.message?.includes('invalid_grant') || err?.message?.includes('Invalid Credentials')) {
      console.log('[gdocs] Token error, forcing refresh...');
      const docs = await getUncachableGoogleDocsClientRetry();
      return await attempt(docs);
    }
    console.error('[gdocs] getDocContent error:', err?.message || err);
    throw err;
  }
}

export async function listRecentDocs(): Promise<Array<{ id: string; title: string }>> {
  try {
    const accessToken = await getAccessToken();
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const res = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.document'",
      pageSize: 20,
      orderBy: 'modifiedTime desc',
      fields: 'files(id, name)',
    });

    return (res.data.files || []).map(f => ({ id: f.id!, title: f.name! }));
  } catch (err: any) {
    if (err?.code === 401 || err?.code === 403 || err?.message?.includes('Insufficient') || err?.message?.includes('invalid_grant')) {
      try {
        const accessToken = await getAccessToken(true);
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: accessToken });
        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        const res = await drive.files.list({
          q: "mimeType='application/vnd.google-apps.document'",
          pageSize: 20,
          orderBy: 'modifiedTime desc',
          fields: 'files(id, name)',
        });

        return (res.data.files || []).map(f => ({ id: f.id!, title: f.name! }));
      } catch {
        return [];
      }
    }
    return [];
  }
}
