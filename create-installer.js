const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Используем уже собранную версию
const appDir = path.join(__dirname, 'release', 'win-unpacked');
const outputDir = path.join(__dirname, 'release');

if (!fs.existsSync(appDir)) {
  console.error('Ошибка: директория win-unpacked не найдена!');
  console.error('Сначала выполните: npm run build:win:dir');
  process.exit(1);
}

console.log('Создание установщика из:', appDir);

// Создаем установщик через electron-builder, используя уже собранную версию
try {
  execSync(
    `npx electron-builder --win --x64 --config.win.target=nsis --config.win.sign=false --config.directories.output=${outputDir} --prepackaged=${appDir}`,
    { stdio: 'inherit', cwd: __dirname, env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' } }
  );
  console.log('\n✅ Установщик успешно создан!');
} catch (error) {
  console.error('\n❌ Ошибка создания установщика:', error.message);
  console.log('\nАльтернатива: используйте уже упакованную версию из release\\SafeKey-win32-x64');
  process.exit(1);
}

