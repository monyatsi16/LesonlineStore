const fs = require('fs');
const size = 32;
const radius = 5;
const bg = [26, 26, 46, 255];
const white = [255, 255, 255, 255];
const pink = [196, 94, 114, 255];
const transparent = [0, 0, 0, 0];
const pixels = Buffer.alloc(size * size * 4);
const drawPixel = (px, py, color) => { if (px >= 0 && px < size && py >= 0 && py < size) { const idx = ((size - 1 - py) * size + px) * 4; pixels[idx] = color[2]; pixels[idx+1] = color[1]; pixels[idx+2] = color[0]; pixels[idx+3] = color[3]; } };
const drawRect = (sx, sy, w, h, color) => { for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) drawPixel(sx + dx, sy + dy, color); };
for (let y = 0; y < size; y++) { for (let x = 0; x < size; x++) { const idx = ((size - 1 - y) * size + x) * 4; let inside = true; if (x < radius && y < radius) { const dx = radius-x-1, dy = radius-y-1; inside = (dx*dx+dy*dy) <= (radius*radius); } if (x >= size-radius && y < radius) { const dx = x-(size-radius), dy = radius-y-1; inside = (dx*dx+dy*dy) <= (radius*radius); } if (x < radius && y >= size-radius) { const dx = radius-x-1, dy = y-(size-radius); inside = (dx*dx+dy*dy) <= (radius*radius); } if (x >= size-radius && y >= size-radius) { const dx = x-(size-radius), dy = y-(size-radius); inside = (dx*dx+dy*dy) <= (radius*radius); } const color = inside ? bg : transparent; pixels[idx] = color[2]; pixels[idx+1] = color[1]; pixels[idx+2] = color[0]; pixels[idx+3] = color[3]; } }
drawRect(5,6,3,12,white); drawRect(5,15,7,3,white); drawRect(13,6,3,12,white); drawRect(13,6,7,3,white); drawRect(13,11,6,2,white); drawRect(13,15,7,3,white); drawRect(21,6,7,3,white); drawRect(21,6,3,6,white); drawRect(21,11,7,2,white); drawRect(25,11,3,7,white); drawRect(21,15,7,3,white);
[[7,22],[8,22],[7,23],[9,23],[7,24],[8,24],[11,22],[11,23],[11,24],[12,22],[13,22],[13,23],[13,24],[15,20],[15,21],[15,22],[15,23],[15,24],[17,20],[17,22],[17,23],[17,24],[19,22],[19,23],[19,24],[20,22],[21,22],[21,23],[21,24],[23,22],[24,22],[25,22],[23,23],[24,23],[23,24],[24,24],[25,24]].forEach(([px,py]) => drawPixel(px,py,pink));
const infoHeader = Buffer.alloc(40); infoHeader.writeUInt32LE(40,0); infoHeader.writeInt32LE(size,4); infoHeader.writeInt32LE(size*2,8); infoHeader.writeUInt16LE(1,12); infoHeader.writeUInt16LE(32,14); infoHeader.writeUInt32LE(pixels.length,20);
const bmpData = Buffer.concat([infoHeader, pixels]);
const header = Buffer.alloc(6); header.writeUInt16LE(0,0); header.writeUInt16LE(1,2); header.writeUInt16LE(1,4);
const dirEntry = Buffer.alloc(16); dirEntry.writeUInt8(size,0); dirEntry.writeUInt8(size,1); dirEntry.writeUInt16LE(1,4); dirEntry.writeUInt16LE(32,6); dirEntry.writeUInt32LE(bmpData.length,8); dirEntry.writeUInt32LE(22,12);
fs.writeFileSync('client/public/favicon.ico', Buffer.concat([header, dirEntry, bmpData]));
console.log('Done! favicon.ico created in client/public/');