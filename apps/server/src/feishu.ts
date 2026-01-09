export class FeishuClient {
  private appId: string;
  private appSecret: string;
  private token: string | null = null;
  private tokenExpireAt: number = 0;

  constructor(appId: string, appSecret: string) {
    this.appId = appId;
    this.appSecret = appSecret;
  }

  private async getTenantAccessToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpireAt) {
      return this.token;
    }

    const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: this.appId,
        app_secret: this.appSecret,
      }),
    });

    const data = await res.json();
    if (data.code !== 0) {
      throw new Error(`Failed to get tenant access token: ${data.msg}`);
    }

    this.token = data.tenant_access_token;
    // Expire 5 minutes early to be safe
    this.tokenExpireAt = Date.now() + (data.expire * 1000) - 300000;
    return this.token!;
  }

  async sendMessage(receiveId: string, receiveIdType: 'open_id' | 'user_id' | 'email', msgType: string, content: any) {
    const token = await this.getTenantAccessToken();
    
    // Content needs to be stringified for 'text' type, but might be object for 'interactive'
    // Feishu API expects 'content' field to be a JSON string for most types
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);

    const res = await fetch(`https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${receiveIdType}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        receive_id: receiveId,
        msg_type: msgType,
        content: contentStr,
      }),
    });

    const data = await res.json();
    if (data.code !== 0) {
      console.error('Feishu send message error:', data);
      throw new Error(`Failed to send message: ${data.msg}`);
    }
    return data;
  }

  async getUserAccessToken(code: string): Promise<any> {
    const token = await this.getTenantAccessToken();
    
    const res = await fetch('https://open.feishu.cn/open-apis/authen/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
      }),
    });

    const data = await res.json();
    if (data.code !== 0) {
      console.error('Feishu get user access token error:', data);
      throw new Error(`Failed to get user access token: ${data.msg}`);
    }
    
    return data.data;
  }
}

// Singleton instance - replace with env vars in production
export const feishuClient = new FeishuClient(
  process.env.FEISHU_APP_ID || 'cli_xxx', 
  process.env.FEISHU_APP_SECRET || 'xxx'
);
