import fs from 'fs';
import archiver from 'archiver';

// 压缩目录函数
function zipDirectory(source, output) {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } }); // 设置压缩级别
    const stream = fs.createWriteStream(output);

    // 监听流完成事件
    stream.on('close', () => resolve());
    stream.on('error', (err) => reject(err));

    // 压缩目录
    archive.directory(source, true); // 压缩文件夹，保留目录结构
    archive.pipe(stream);

    // 完成压缩
    archive.finalize();
  });
}

// 获取命令行参数
const args = process.argv.slice(2);
const sourceDir = args[0];
const outputZip = args[1];

// 检查参数
if (!sourceDir || !outputZip) {
  console.error('请提供源目录和输出zip文件路径');
  process.exit(1);
}

// 检查源目录是否存在
if (!fs.existsSync(sourceDir)) {
  console.error(`源目录不存在: ${sourceDir}`);
  process.exit(1);
}

// 检查输出文件是否存在
if (fs.existsSync(outputZip)) {
  console.warn(`输出文件已存在: ${outputZip}，将覆盖`);
  fs.unlinkSync(outputZip);
}

// 执行压缩
zipDirectory(sourceDir, outputZip)
  .then(() => console.log(`已压缩到: ${outputZip}`))
  .catch((err) => {
    console.error('压缩失败:', err);
    process.exit(1);
  });
