// Скрипт для проверки размеров иконки через Node.js
// Запустите: node check-icon.js

const fs = require('fs');
const path = require('path');

const iconPath = path.join(__dirname, 'build', 'icon.ico');

if (!fs.existsSync(iconPath)) {
    console.error('❌ Файл icon.ico не найден!');
    process.exit(1);
}

console.log('🔍 Проверка иконки:', iconPath);
console.log('');

// Читаем файл
const iconBuffer = fs.readFileSync(iconPath);
const fileSize = iconBuffer.length;

console.log(`📦 Размер файла: ${fileSize} байт`);
console.log('');

// Проверяем заголовок ICO файла
if (iconBuffer.length < 6) {
    console.error('❌ Файл слишком маленький, это не валидный ICO файл!');
    process.exit(1);
}

// ICO файл начинается с:
// - 2 байта: Reserved (должно быть 0)
// - 2 байта: Type (1 = ICO, 2 = CUR)
// - 2 байта: Number of images

const reserved = iconBuffer.readUInt16LE(0);
const type = iconBuffer.readUInt16LE(2);
const numImages = iconBuffer.readUInt16LE(4);

console.log(`📊 Заголовок ICO:`);
console.log(`   Reserved: ${reserved}`);
console.log(`   Type: ${type} (1 = ICO, 2 = CUR)`);
console.log(`   Количество изображений: ${numImages}`);
console.log('');

if (reserved !== 0 || type !== 1) {
    console.error('❌ Это не валидный ICO файл!');
    process.exit(1);
}

// Читаем информацию о каждом изображении
const requiredSizes = [16, 32, 48, 256];
const foundSizes = [];

console.log('🔎 Проверка размеров:');
console.log('');

const iconDirOffset = 6;
for (let i = 0; i < numImages; i++) {
    const offset = iconDirOffset + (i * 16);
    
    if (offset + 16 > iconBuffer.length) {
        console.error('❌ Ошибка чтения структуры ICO файла!');
        break;
    }
    
    const width = iconBuffer[offset] === 0 ? 256 : iconBuffer[offset];
    const height = iconBuffer[offset + 1] === 0 ? 256 : iconBuffer[offset + 1];
    const colorPlanes = iconBuffer.readUInt16LE(offset + 4);
    const bitsPerPixel = iconBuffer.readUInt16LE(offset + 6);
    const imageSize = iconBuffer.readUInt32LE(offset + 8);
    const imageOffset = iconBuffer.readUInt32LE(offset + 12);
    
    if (requiredSizes.includes(width) && width === height) {
        foundSizes.push(width);
        console.log(`   ✓ ${width}x${height} - найден (${bitsPerPixel} бит, ${imageSize} байт)`);
    } else {
        console.log(`   • ${width}x${height} - другой размер (${bitsPerPixel} бит)`);
    }
}

console.log('');

if (foundSizes.length === requiredSizes.length) {
    console.log('✅ Все необходимые размеры присутствуют!');
    console.log(`   Найдено: ${foundSizes.sort((a, b) => a - b).join(', ')}`);
} else {
    console.log('❌ Отсутствуют некоторые размеры!');
    console.log(`   Найдено: ${foundSizes.length > 0 ? foundSizes.sort((a, b) => a - b).join(', ') : 'нет'}`);
    console.log(`   Требуется: ${requiredSizes.join(', ')}`);
    console.log('');
    console.log('💡 Рекомендации:');
    console.log('   1. Используйте онлайн-конвертер: https://convertio.co/ru/png-ico/');
    console.log('   2. Или программу IcoFX: https://icofx.ro/');
    console.log('   3. Убедитесь, что создаете ICO с размерами: 16x16, 32x32, 48x48, 256x256');
}

