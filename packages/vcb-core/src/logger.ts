// packages/vcb-core/src/logger.ts
// pino 기반 구조화 로거. run_id 컨텍스트 자동 주입.

import pino from 'pino';

export type Logger = pino.Logger;

const isDev = process.env.NODE_ENV !== 'production';

const baseConfig: pino.LoggerOptions = {
  level: process.env.VCB_LOG_LEVEL ?? 'info',
  base: {
    pkg: 'vcb',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

const prettyTransport = isDev
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname,pkg',
        singleLine: false,
      },
    }
  : undefined;

export function createLogger(context: {
  script: string;
  run_id?: number;
  source_id?: number;
  spec_id?: number;
}): Logger {
  const opts: pino.LoggerOptions = {
    ...baseConfig,
    ...(prettyTransport && { transport: prettyTransport }),
  };

  return pino(opts).child(context);
}
