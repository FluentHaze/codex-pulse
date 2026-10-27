/**
 * 开发诊断入口：验证本机 Codex 连接及协议响应，不参与生产应用启动。
 */
import { CodexClient, detectCodex } from '../electron/codex.js';
import type { Account, Limits } from '../electron/types.js';
import { bucketsFrom } from '../electron/types.js';
const client = new CodexClient();
try {
  await client.start(detectCodex());
  const { account } = await client.request<{ account: Account | null }>('account/read', {
    refreshToken: false,
  });
  const limits = await client.request<Limits>('account/rateLimits/read');
  console.log(
    JSON.stringify(
      {
        authenticated: !!account,
        type: account?.type,
        plan: account?.planType,
        buckets: bucketsFrom(limits).map((bucket) => ({
          limitId: bucket.limitId,
          primary: bucket.primary,
          secondary: bucket.secondary,
        })),
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : '读取失败');
  process.exitCode = 1;
} finally {
  client.stop();
}
