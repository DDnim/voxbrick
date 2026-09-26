# Voxbrick

把体素模型拆成**最普通的长方形积木**（砖或薄板，1×1〜2×8 共 11 种尺寸），
在网页上显示 3D 成品、零件清单和一步一步的拼装图。作品库由大家用 PR 一起添加。

**在线看：<https://voxbrick.wtome.com>**

- 上下层自动错缝咬合，悬空的零件一定扣在有支撑的地方
- 检查整体连成一块、重心落在底面范围内
- 拼装步骤逐层显示（3D 高亮 + 俯视图 + 这一步要用的零件），悬空的部分作为小组件从下面扣上
- 导入：作品 JSON、MagicaVoxel `.vox`；导出：作品 JSON、`.vox`、零件清单 CSV

## 快速开始

```sh
npm install
npm run build        # → dist/voxbrick.html（单个文件，双击就能打开）
npm test
```

页面用 `?w=<作品 id>` 切换作品，比如 `dist/voxbrick.html?w=lucky-cat`。
右上角的 EN / 中文 按钮切换界面语言（记在浏览器里；也可以用 `?lang=en` 指定）。

只想自己看、不公开的作品（比如有版权的角色）放在 `works-local/`（已在 .gitignore 里）：
`works-local/*.js` 用 `npm run works:local` 生成 JSON，`npm run build:local` 输出带上它们的 `dist/voxbrick-local.html`。
普通的 `npm run build` 不会包含这些作品。

## 现在有的作品

| 作品 | 零件 | 说明 |
| --- | --- | --- |
| 雪人 `snowman` | 砖 200 块 | 适合第一次拼 |
| 小机器人 `robot` | 砖 129 块 | 方头方身体，胸口有指示灯 |
| 招财猫 `lucky-cat` | 薄板 742 块 | 用薄板画出五官 |

## 添加作品

见 [CONTRIBUTING.md](CONTRIBUTING.md)。作品文件格式见 [docs/work-format.md](docs/work-format.md)。

## 目录

| 路径 | 内容 |
| --- | --- |
| `works/*.json` | 作品（页面打包时全部读进来） |
| `works-src/*.js` | 用代码画的作品，`npm run works` 生成对应的 JSON |
| `schema/work.schema.json` | 作品文件的 JSON Schema |
| `src/core/catalog.js` | 零件和颜色目录 |
| `src/core/work.js` | 作品文件的检查、读写 |
| `src/core/vox.js` | MagicaVoxel `.vox` 导入导出 |
| `src/core/tiler.js` | 按层把体素拆成零件：错缝、悬空格必须够到支撑、最后保证整体连通 |
| `src/core/instructions.js` | 零件表、拼装步骤、重心检查 |
| `src/web/` | Three.js 3D 显示和页面 |
| `scripts/` | 打包、生成作品、导入 `.vox`、统计、截图 |

## 许可

代码：MIT。作品：各自文件里 `license` 字段写的许可（CC0-1.0 / CC-BY-4.0 / CC-BY-SA-4.0）。
