// Скрипт для проверки конфигурации electron-builder и путей к иконкам
// Запустите: node check-electron-builder-config.js

const fs = require('fs');
const path = require('path');

console.log('🔍 Проверка конфигурации electron-builder для иконок');
console.log('');

// Читаем package.json
const packageJsonPath = path.join(__dirname, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
    console.error('❌ package.json не найден!');
    process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const buildConfig = packageJson.build;

if (!buildConfig) {
    console.error('❌ Секция "build" не найдена в package.json!');
    process.exit(1);
}

console.log('📋 Конфигурация electron-builder:');
console.log('');

// Проверяем buildResources
const buildResources = buildConfig.directories?.buildResources || 'build';
console.log(`📁 buildResources: ${buildResources}`);

// Проверяем корневую иконку
const rootIcon = buildConfig.icon;
if (rootIcon) {
    console.log(`🎯 Корневая иконка (build.icon): ${rootIcon}`);
    const rootIconPath = path.resolve(__dirname, rootIcon);
    if (fs.existsSync(rootIconPath)) {
        console.log(`   ✓ Файл существует: ${rootIconPath}`);
    } else {
        console.log(`   ❌ Файл НЕ найден: ${rootIconPath}`);
    }
} else {
    console.log('   ⚠️  Корневая иконка не указана');
}

console.log('');

// Проверяем иконку для Windows
const winConfig = buildConfig.win;
if (winConfig) {
    const winIcon = winConfig.icon;
    if (winIcon) {
        console.log(`🪟 Иконка Windows (build.win.icon): ${winIcon}`);
        
        // Проверяем разные варианты пути
        const possiblePaths = [
            path.resolve(__dirname, winIcon),
            path.resolve(__dirname, buildResources, winIcon.replace(/^build\//, '')),
            path.resolve(__dirname, winIcon.replace(/^build\//, '')),
        ];
        
        let found = false;
        for (const iconPath of possiblePaths) {
            if (fs.existsSync(iconPath)) {
                console.log(`   ✓ Файл существует: ${iconPath}`);
                found = true;
                break;
            }
        }
        
        if (!found) {
            console.log(`   ❌ Файл НЕ найден ни по одному из путей:`);
            possiblePaths.forEach(p => console.log(`      - ${p}`));
        }
    } else {
        console.log('   ⚠️  Иконка Windows не указана (будет использована корневая)');
    }
} else {
    console.log('   ⚠️  Секция win не найдена');
}

console.log('');

// Проверяем иконки NSIS
const nsisConfig = buildConfig.nsis;
if (nsisConfig) {
    const installerIcon = nsisConfig.installerIcon;
    const uninstallerIcon = nsisConfig.uninstallerIcon;
    
    if (installerIcon) {
        console.log(`📦 Иконка установщика (build.nsis.installerIcon): ${installerIcon}`);
        const installerIconPath = path.resolve(__dirname, installerIcon);
        if (fs.existsSync(installerIconPath)) {
            console.log(`   ✓ Файл существует: ${installerIconPath}`);
        } else {
            console.log(`   ❌ Файл НЕ найден: ${installerIconPath}`);
        }
    }
    
    if (uninstallerIcon) {
        console.log(`🗑️  Иконка деинсталлятора (build.nsis.uninstallerIcon): ${uninstallerIcon}`);
        const uninstallerIconPath = path.resolve(__dirname, uninstallerIcon);
        if (fs.existsSync(uninstallerIconPath)) {
            console.log(`   ✓ Файл существует: ${uninstallerIconPath}`);
        } else {
            console.log(`   ❌ Файл НЕ найден: ${uninstallerIconPath}`);
        }
    }
}

console.log('');
console.log('💡 Рекомендации:');
console.log('');

// Проверяем основной файл иконки
const mainIconPath = path.join(__dirname, 'build', 'icon.ico');
if (fs.existsSync(mainIconPath)) {
    console.log('✅ Основной файл иконки найден: build/icon.ico');
    
    // Проверяем размеры иконки
    const iconBuffer = fs.readFileSync(mainIconPath);
    if (iconBuffer.length >= 6) {
        const numImages = iconBuffer.readUInt16LE(4);
        console.log(`   Количество изображений в ICO: ${numImages}`);
    }
} else {
    console.log('❌ Основной файл иконки НЕ найден: build/icon.ico');
}

console.log('');
console.log('📝 Текущая конфигурация:');
console.log('   - buildResources: ' + buildResources);
if (rootIcon) {
    console.log('   - build.icon: ' + rootIcon);
}
if (winConfig?.icon) {
    console.log('   - build.win.icon: ' + winConfig.icon);
}
console.log('');
console.log('💡 Если иконка не встраивается, попробуйте:');
console.log('   1. Изменить путь в build.win.icon на "icon.ico" (если buildResources = "build")');
console.log('   2. Удалить build.win.icon и оставить только build.icon');
console.log('   3. Использовать абсолютный путь: "./build/icon.ico"');
console.log('   4. Переместить icon.ico в корень проекта');

