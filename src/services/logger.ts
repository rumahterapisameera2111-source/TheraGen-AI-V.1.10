type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 100;

  private addLog(level: LogLevel, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };
    
    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    const color = {
      info: '\x1b[32m',
      warn: '\x1b[33m',
      error: '\x1b[31m',
      debug: '\x1b[34m'
    }[level];

    console.log(`${color}[${entry.timestamp}] [${level.toUpperCase()}] ${message}\x1b[0m`, data || '');
  }

  info(message: string, data?: any) {
    this.addLog('info', message, data);
  }

  warn(message: string, data?: any) {
    this.addLog('warn', message, data);
  }

  error(message: string, data?: any) {
    this.addLog('error', message, data);
  }

  debug(message: string, data?: any) {
    this.addLog('debug', message, data);
  }

  getLogs() {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
  }
}

export const logger = new Logger();
