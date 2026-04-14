// Mineflayer Bot - Target Selection System
// Requires: mineflayer, mineflayer-pathfinder, mineflayer-pvp

const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').pvp;
const GoalNear = goals.GoalNear;

// ==================== CONFIGURATION ====================

const config = {
    // Whitelist - игроки, которых бот игнорирует
    whitelist: ['Demon232323'],
    
    // Префиксы ботов для игнорирования
    botPrefixes: ['Pro', 'Shadow', 'Mega'],
    
    // Радиус обнаружения целей (в блоках)
    detectionRadius: 200,
    
    // Настройки для маскировки
    mask: {
        // Список имен для генерации никнеймов
        names: [
            'Steve', 'Alex', 'Craft', 'Miner', 'Builder', 
            'Warrior', 'Hunter', 'Explorer', 'Knight', 'Ranger',
            'Dragon', 'Phoenix', 'Wolf', 'Eagle', 'Tiger',
            'Storm', 'Blaze', 'Frost', 'Thunder', 'Shadow'
        ],
        // Минимальное и максимальное количество цифр в нике
        minDigits: 2,
        maxDigits: 4
    },
    
    // Сервер для подключения
    host: 'localhost',
    port: 25565,
    username: generateNickname(), // Генерируем ник при старте
    version: false // Авто-определение версии
};

// ==================== NICKNAME GENERATOR ====================

/**
 * Генерирует реалистичный никнейм для маскировки под обычного игрока
 * Комбинирует случайные имена и цифры
 */
function generateNickname() {
    const names = config.mask.names;
    const randomName = names[Math.floor(Math.random() * names.length)];
    
    // Генерируем случайное число цифр между min и max
    const numDigits = Math.floor(
        Math.random() * (config.mask.maxDigits - config.mask.minDigits + 1)
    ) + config.mask.minDigits;
    
    // Генерируем случайные цифры
    let digits = '';
    for (let i = 0; i < numDigits; i++) {
        digits += Math.floor(Math.random() * 10);
    }
    
    // Случайно решаем, ставить ли цифры в конец или начало
    const prefix = Math.random() > 0.5;
    
    return prefix ? `${digits}${randomName}` : `${randomName}${digits}`;
}

/**
 * Генерирует массив из нескольких ников для конфигурации
 * @param {number} count - количество ников для генерации
 * @returns {string[]} массив сгенерированных ников
 */
function generateNicknameList(count) {
    const nicknames = [];
    for (let i = 0; i < count; i++) {
        nicknames.push(generateNickname());
    }
    return nicknames;
}

// ==================== TARGET SELECTION ====================

/**
 * Проверяет, находится ли игрок в белом списке или является ботом
 * @param {string} username - имя игрока
 * @returns {boolean} true если игрок должен быть проигнорирован
 */
function isIgnored(username) {
    // Проверяем явный белый список
    if (config.whitelist.includes(username)) {
        console.log(`[Target] Игнорируем игрока из белого списка: ${username}`);
        return true;
    }
    
    // Проверяем префиксы ботов
    for (const prefix of config.botPrefixes) {
        if (username.startsWith(prefix)) {
            console.log(`[Target] Игнорируем бота с префиксом ${prefix}: ${username}`);
            return true;
        }
    }
    
    return false;
}

/**
 * Находит ближайшую допустимую цель в радиусе
 * @param {import('mineflayer').Bot} bot - экземпляр бота
 * @returns {import('mineflayer').Entity|null} найденная цель или null
 */
function findNearestTarget(bot) {
    const botPosition = bot.entity.position;
    let nearestTarget = null;
    let nearestDistance = config.detectionRadius;
    
    // Проверяем всех игроков
    for (const entity of Object.values(bot.entities)) {
        // Пропускаем не живые сущности
        if (entity.type !== 'player' && entity.type !== 'mob') {
            continue;
        }
        
        // Пропускаем самого бота
        if (entity.username === bot.username) {
            continue;
        }
        
        // Вычисляем расстояние
        const distance = botPosition.distanceTo(entity.position);
        
        // Пропускаем если за пределами радиуса
        if (distance > config.detectionRadius) {
            continue;
        }
        
        // Для игроков проверяем белый список
        if (entity.type === 'player' && entity.username) {
            if (isIgnored(entity.username)) {
                continue;
            }
        }
        
        // Проверяем, жива ли сущность
        if (entity.health <= 0) {
            continue;
        }
        
        // Обновляем ближайшую цель
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestTarget = entity;
        }
    }
    
    return nearestTarget;
}

// ==================== COMBAT BEHAVIOR ====================

/**
 * Атакует указанную цель
 * @param {import('mineflayer').Bot} bot - экземпляр бота
 * @param {import('mineflayer').Entity} target - цель для атаки
 */
function attackTarget(bot, target) {
    console.log(`[Combat] Начинаем атаку на: ${target.username || target.type}`);
    
    // Включаем PvP
    bot.pvp.attack(target);
}

/**
 * Подбирается к цели на расстояние атаки
 * @param {import('mineflayer').Bot} bot - экземпляр бота
 * @param {import('mineflayer').Entity} target - цель
 */
async function approachTarget(bot, target) {
    const botPosition = bot.entity.position;
    const targetPosition = target.position;
    const distance = botPosition.distanceTo(targetPosition);
    
    // Дистанция атаки (обычно 3-4 блока для ближнего боя)
    const attackRange = 3.5;
    
    if (distance > attackRange) {
        console.log(`[Pathfinder] Приближаемся к цели (расстояние: ${distance.toFixed(1)})`);
        
        const goal = new GoalNear(
            Math.floor(targetPosition.x),
            Math.floor(targetPosition.y),
            Math.floor(targetPosition.z),
            attackRange
        );
        
        try {
            await bot.pathfinder.goto(goal);
            return true;
        } catch (err) {
            console.error('[Pathfinder] Ошибка пути:', err);
            return false;
        }
    }
    
    return true;
}

/**
 * Основной цикл выбора и атаки цели
 * @param {import('mineflayer').Bot} bot - экземпляр бота
 */
function startTargetSelection(bot) {
    console.log('[System] Система выбора цели запущена');
    console.log(`[System] Радиус обнаружения: ${config.detectionRadius} блоков`);
    console.log(`[System] Белый список: ${config.whitelist.join(', ')}`);
    console.log(`[System] Префиксы ботов: ${config.botPrefixes.join(', ')}`);
    
    let currentTarget = null;
    let isApproaching = false;
    
    // Обновляем состояние каждые 500мс
    const checkInterval = setInterval(() => {
        if (!bot.entity || !bot.isInGame) {
            return;
        }
        
        // Если текущей цели нет или она мертва/недоступна - ищем новую
        if (!currentTarget || 
            !bot.entities[currentTarget.id] || 
            currentTarget.health <= 0) {
            
            // Если были в процессе приближения - останавливаемся
            if (isApproaching) {
                bot.pathfinder.stop();
                isApproaching = false;
            }
            
            // Ищем новую цель
            currentTarget = findNearestTarget(bot);
            
            if (currentTarget) {
                console.log(`[Target] Новая цель найдена: ${currentTarget.username || currentTarget.type} (${currentTarget.id})`);
            } else {
                // Целей нет - останавливаем атаку
                if (bot.pvp) {
                    bot.pvp.stop();
                }
                return;
            }
        }
        
        // Если цель есть - действуем
        if (currentTarget) {
            // Проверяем дистанцию
            const distance = bot.entity.position.distanceTo(currentTarget.position);
            
            if (distance > 4) {
                // Нужно подойти ближе
                if (!isApproaching) {
                    isApproaching = true;
                    approachTarget(bot, currentTarget).then(() => {
                        isApproaching = false;
                    });
                }
            } else {
                // Достаточно близко - атакуем
                isApproaching = false;
                attackTarget(bot, currentTarget);
            }
        }
    }, 500);
    
    // Сохраняем интервал для возможной остановки
    bot.targetSelection = {
        interval: checkInterval,
        stop: () => {
            clearInterval(checkInterval);
            bot.pvp.stop();
            bot.pathfinder.stop();
            console.log('[System] Система выбора цели остановлена');
        }
    };
}

// ==================== BOT INITIALIZATION ====================

/**
 * Создает и настраивает бота
 * @returns {import('mineflayer').Bot}
 */
function createBot(customConfig = {}) {
    const finalConfig = { ...config, ...customConfig };
    
    const bot = mineflayer.createBot({
        host: finalConfig.host,
        port: finalConfig.port,
        username: finalConfig.username,
        version: finalConfig.version
    });
    
    // Подключаем плагины
    bot.loadPlugin(pathfinder);
    bot.loadPlugin(pvp);
    
    // Настраиваем движения
    const defaultMove = new Movements(bot);
    bot.pathfinder.setMovements(defaultMove);
    
    // Обработчики событий
    bot.on('spawn', () => {
        console.log(`[Bot] Бот заспавнился как ${bot.username}`);
        startTargetSelection(bot);
    });
    
    bot.on('health', () => {
        if (bot.health <= 0) {
            console.log('[Bot] Бот умер! Переподключение...');
            // Здесь можно добавить логику переподключения
        }
    });
    
    bot.on('kicked', (reason) => {
        console.log('[Bot] Кикнут с сервера:', reason);
    });
    
    bot.on('error', (err) => {
        console.error('[Bot] Ошибка:', err);
    });
    
    return bot;
}

// ==================== EXPORTS ====================

module.exports = {
    // Функции
    generateNickname,
    generateNicknameList,
    isIgnored,
    findNearestTarget,
    attackTarget,
    approachTarget,
    startTargetSelection,
    createBot,
    
    // Конфигурация
    config
};

// ==================== CLI USAGE ====================

// Если запускаем напрямую - создаем бота
if (require.main === module) {
    console.log('=== Mineflayer Combat Bot ===\n');
    
    // Показываем несколько примеров сгенерированных ников
    console.log('Примеры сгенерированных ников:');
    const examples = generateNicknameList(5);
    examples.forEach((nick, i) => {
        console.log(`  ${i + 1}. ${nick}`);
    });
    
    console.log('\nДля запуска бота отредактируйте config и вызовите createBot()');
    console.log('Или используйте как модуль: const bot = require("./bot").createBot({...})\n');
    
    // Создаем бота (раскомментируйте и настройте для реального использования)
    // const bot = createBot({
    //     host: 'your.server.com',
    //     port: 25565,
    //     username: generateNickname()
    // });
}
