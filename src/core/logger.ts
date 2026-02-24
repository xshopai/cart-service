/**
 * Logger module for cart-service
 * Winston-based logger with correlation ID support
 */
import winston from 'winston';
import config from './config.js';

const IS_DEVELOPMENT = config.service.nodeEnv === 'development';
const IS_PRODUCTION = config.service.nodeEnv === 'production';
const NAME = config.service.name;
const LOG_FORMAT = config.logging.format;

/**
 * Console formatter for development
 */
const consoleFormat = winston.format.printf(({ level, message, timestamp, traceId, ...meta }) => {
  const colors: Record<string, string> = {
    error: '\x1b[31m',
    warn: '\x1b[33m',
    info: '\x1b[32m',
    debug: '\x1b[34m',
  };
  const reset = '\x1b[0m';
  const color = colors[level] || '';

  const traceIdShort = traceId && typeof traceId === 'string' ? traceId.substring(0, 8) : 'no-trace';
  const traceInfo = `[trace:${traceIdShort}]`;
  const metaStr = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';

  return `${color}[${timestamp}] [${level.toUpperCase()}] ${NAME} ${traceInfo}: ${message}${metaStr}${reset}`;
});

/**
 * JSON formatter for production
 */
const jsonFormat = winston.format.printf(({ level, message, timestamp, traceId, spanId, ...meta }) => {
  return JSON.stringify({
    timestamp,
    level,
    service: NAME,
    traceId: traceId || null,
    spanId: spanId || null,
    message,
    ...meta,
  });
});

/**
 * Create Winston logger
 */
const createLogger = () => {
  const transports: winston.transport[] = [];

  // Console transport
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.timestamp(), LOG_FORMAT === 'json' ? jsonFormat : consoleFormat),
    }),
  );

  // File transport
  if (config.logging.toFile) {
    transports.push(
      new winston.transports.File({
        filename: config.logging.filePath,
        format: winston.format.combine(winston.format.timestamp(), jsonFormat),
      }),
    );
  }

  return winston.createLogger({
    level: config.logging.level,
    transports,
    exitOnError: false,
  });
};

const logger = createLogger();

export default logger;
