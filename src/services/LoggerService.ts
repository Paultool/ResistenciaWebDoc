export type LogCategory = 'AUTH' | 'FLOW' | 'STATS' | 'MEDIA' | 'ADMIN' | 'SYSTEM' | 'GENERAL';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogConfig {
    [key: string]: boolean | string;
    level: LogLevel;
}

class LoggerService {
    private static instance: LoggerService;
    private config: LogConfig = {
        AUTH: true,
        FLOW: true,
        STATS: true,
        MEDIA: true,
        ADMIN: true,
        SYSTEM: true,
        GENERAL: true,
        level: 'info'
    };

    private constructor() { }

    static getInstance(): LoggerService {
        if (!LoggerService.instance) {
            LoggerService.instance = new LoggerService();
        }
        return LoggerService.instance;
    }

    setConfig(newConfig: Partial<LogConfig>) {
        this.config = { ...this.config, ...newConfig };
    }

    private shouldLog(category: LogCategory, level: LogLevel): boolean {
        const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
        const configLevelIndex = levels.indexOf(this.config.level);
        const currentLevelIndex = levels.indexOf(level);

        if (currentLevelIndex < configLevelIndex) return false;
        if (this.config[category] === false) return false;

        return true;
    }

    debug(category: LogCategory, message: string, ...args: any[]) {
        if (this.shouldLog(category, 'debug')) {
            console.debug(`[${category}] 🔍 ${message}`, ...args);
        }
    }

    info(category: LogCategory, message: string, ...args: any[]) {
        if (this.shouldLog(category, 'info')) {
            console.info(`[${category}] ℹ️ ${message}`, ...args);
        }
    }

    warn(category: LogCategory, message: string, ...args: any[]) {
        if (this.shouldLog(category, 'warn')) {
            console.warn(`[${category}] ⚠️ ${message}`, ...args);
        }
    }

    error(category: LogCategory, message: string, ...args: any[]) {
        if (this.shouldLog(category, 'error')) {
            console.error(`[${category}] ❌ ${message}`, ...args);
        }
    }
}

export const Logger = LoggerService.getInstance();
