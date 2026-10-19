# Sensor DN Power Studio

[Open the web app](https://sumu2he.github.io/sensor-dn-power-studio/) · [GitHub repository](https://github.com/SuMu2he/sensor-dn-power-studio)

无需安装、无需登录。浏览器本地处理图像；源码公开不会上传使用者导入的图片。

MATLAB `MoirePowerDensityApp` 的独立网页版本。所有操作界面使用英文（Help/About 底部按用户要求保留随机古诗文原文）；参考 Binary Mask Studio 的浅色、深绿和荧光绿视觉风格。原 MATLAB 程序与参考网站不受影响。

## 使用

1. `Import` 导入 PNG、TIFF、BMP 或灰度 JPEG；也可将文件拖入网页。首次可使用 `Try a synthetic sample`。
2. `Image → Preprocessing` 输入 Ka、Kb。计算数据统一为 `clip(round(Ka × raw DN + Kb), 0, 2^bitDepth − 1)`。越界数据自动限制到上下限，并在本区显示红色说明。
3. `Rectangle` 拖出绿色矩形，输入 W/H 或拖动控制点调整；中间的锁定按钮保持长宽比。`Polygon` 逐点绘制，Enter、双击或点击起点完成；Esc 取消，Backspace 撤销最后一个点。完成后可以拖动顶点和整个 ROI。
4. 输入 `Parameters`，点击 `Calculate`。只有点击 `Export` 才保存文件。
5. `Path` 可在支持 File System Access API 的浏览器中选择目录；未选择目录或浏览器不支持时，`Export` 下载包含五项结果的 ZIP。

滚轮悬停缩放，左键拖动背景平移，双击背景或 `Fit` 适应视图。`Angle` 仅旋转视图，`Reset` 将角度归零。图像计算和导出均使用原始方向的完整像素。

参考线可拖动；V/H 添加，Clear 清除，Guides 隐藏/显示，右键参考线可删除。`Contrast` 仅将显示范围映射到当前最小/最大 DN，保持计算和保存数据不变。

左侧依次为 `Import / Parameters / Image / Results / Save`，默认宽度 300 px，区块间隔 12 px。Image 内按 Preprocessing、ROI、Guides、View 分组，分组间距 22 px；原图像顶部工具栏已移入此栏。区块按内容确定高度，左栏独立滚动，Save 下方没有占位栏。Import、Calculate、Export 采用相同主按钮样式且保留文字；Save 分三行放置路径与 Path、可编辑前缀与固定 Name 标签、整行 Export。拖动左右区域之间的竖向分隔条可调整侧栏宽度，拖动图像与柱状图之间的横向分隔条可调整两者高度。布局会自动记忆；双击分隔条或聚焦后按 Enter 恢复默认大小，也可使用方向键微调。

所有可编辑数值框均支持四则运算、小数、括号与科学计数法，例如 `630/2`、`(540+100)/2`、`1e-3`。输入时保留表达式，Enter 或失焦后求值；除零、非法表达式和超范围值标红并禁用 Calculate / Export，Esc 恢复上次有效值。参数原有范围与 ROI 整数要求保留。输入框右侧沿用浏览器原有的灰色实心三角箭头，给上下箭头留出完整高度；表达式文本与原生步进区分开，避免数值遮挡。

ROI 使用更亮的绿色边框和较大的尺寸文字，文字不带背景底色。边框显示四向移动指针，八个矩形控制点显示对应的水平、垂直或对角缩放指针；控制点优先识别。

`Expand` 在独立窗口显示柱状图，按窗口尺寸和屏幕像素比例重新绘制。网页和独立窗口的左上角摘要可直接选中复制；功率密度保留三位小数、DN 显示整数，计算精度不变。独立窗口通过浏览器会话存储接收统计快照，网址仅带随机编号；快照不上传服务器，关闭主窗口后仍可查看。导出柱状图直接绘制为 3840 × 2160 PNG，两张实验图片仍保留原始方向、原始分辨率与文件格式。

Histogram 右上角依次为 DN 范围、`Style`、`Expand`，移除了重复的 ROI PIXELS 标签。原生 DN 范围带位深，如 `DN 0–255 (8 bit)`。`Style` 打开 Chart Appearance，可调整柱形颜色与透明度、均值/峰值线的颜色/线宽/线形、标注字号与背景、四边框、刻度、三个轴标题与字号、网格和背景色。实时预览后 Apply 保存到当前浏览器，Cancel 丢弃未应用修改，Reset 将预览恢复默认后仍需 Apply。已打开的独立窗口通过浏览器 storage 事件同步已应用外观，未来 4K 导出也采用同一设置。默认柱形为深绿、均值线为深蓝虚线，并补齐右边框；小图或相邻标记自动使用横向标注，避免文字被裁切。外观设置不进入计算 Worker，不改变物理换算。

Ver.1.3 的 Calculate 使用所选 Function 图标，左侧与图像空白区域的 Import 使用相同导入图标和文字。Results 的功率密度标签明确为 `Peak Power Density` 和 `Mean Power Density`，单位为 μW/cm²。

图表文字默认使用 Segoe UI，依次回退至 Arial 和系统 sans-serif。Style 中可分别设置标记、刻度、轴标题、左上摘要的字体颜色和 Bold / Italic；均值、峰值标记字体颜色与线条颜色独立，摘要的文件名和结果文字可分别加粗/斜体。所有文字设置共享于网页主图、Style 预览、Expand 和 4K PNG。默认柱形颜色为 `#367D5E`、透明度 0.7；均值蓝色虚线和峰值红色实线的宽度均为 2.5；标记、刻度和三个轴标题字号均为 16；黑色图框线宽 1.5，刻度及轴标题为黑色；浅灰色实线网格宽度 1；背景均为白色，标记文字背景默认关闭。旧浏览器保存的颜色、尺寸等设置继续生效，新增文字字段按兼容规则补全；Reset → Apply 可采用新版默认值。

右上角 `?` 打开快速上手、章节导航与可滚动完整说明；`!` 打开应用信息。两个弹窗优先从与 Binary Mask Studio 相同的今日诗词接口 `https://v1.jinrishici.com/all.json` 获取随机古诗文，显示作者与篇名。后台预取下一条，近期 40 条已显示内容保存在本浏览器，刷新后仍参与去重；服务连续返回重复内容时最多重试 3 次。每次预取最多等待 2.8 秒，断网、超时或无效响应时使用本地诗句兜底。诗句请求不包含图片、实验参数或 Cookie，并禁止附带页面 URL 的 Referer。Esc、关闭按钮或点击遮罩均可关闭弹窗。

## 数值定义

默认 λ = 630 nm，像素边长 2.74 μm，增益 0.018492 DN/e⁻，QE = 55%，曝光 1 ms。

```text
Ep_J = h × c / (wavelength_nm × 1e-9)
Ep_eV = Ep_J / elementary_charge
Ne = processed_DN / gain_DN_per_electron
Np = Ne / (QE_percent / 100)
E_J = Np × Ep_J
P_W_per_cm2 = E_J / (exposure_ms × 1e-3) / (pixel_um^2 × 1e-8)
P_uW_per_cm2 = P_W_per_cm2 × 1e6
```

默认参数下每 DN 对应 0.41294145435547536 μW/cm²。峰值为 ROI 内最大处理后 DN 的换算值；均值为全部入选像素 DN 算术均值的换算值。显示中的 DN 整数标注不改变实际均值或均值线位置。

像素中心采用 MATLAB 的 1-based 坐标。矩形包含下边界、不包含上边界；多边形包含边界。旋转时把 ROI 逆变换到原图坐标选择像素，不对测量 DN 做插值。

## 导出规则

文件名前缀默认为 `OriginalName_DN_ROI`，首次编号从 `001` 开始：

| 文件 | 内容 |
|---|---|
| `<prefix>_001_gray.txt` | 以 Tab 分隔的二维处理后 DN 矩阵 |
| `<prefix>_001_gray.xlsx` | 同一二维矩阵，灰度为数值单元格 |
| `<prefix>_001_with_ROI.<ext>` | 绿色 ROI 标记的全分辨率、原始方向处理图 |
| `<prefix>_001_without_ROI.<ext>` | 无 ROI 标记的同一处理图 |
| `<prefix>_001_histogram.png` | 3840 × 2160 像素 4K 柱状图 |

矩阵为原图坐标中的 ROI 包围矩阵，未入选位置是 `NaN`；Excel 中显式写入文本 `NaN`。所有有限 DN 均为取整和限幅后的数据。图片沿用原文件扩展名/格式；ROI 标记图为 RGB。JPEG 再保存具有其固有的有损压缩，TXT/XLSX 和无损图片更适合逐像素比较。

选择目录后，只要一个同组目标文件已存在，就跳过整组编号，避免覆盖不完整导出。ZIP 模式通过当前站点的浏览器本地记录递增编号；网页没有权限扫描未授权的 Downloads 文件夹，清除站点数据后该记录也会清除。

## 架构与优化

| 文件 | 责任 |
|---|---|
| `src/main.tsx` | 界面、参数、操作和状态；修改按钮文字可从此开始 |
| `src/style.css` | 颜色、控件尺寸与分组布局 |
| `src/number-field.tsx` / `src/numeric-expression.ts` | 原生步进箭头、四则表达式与数值错误拦截 |
| `src/chart-style.ts` / `src/chart-style-dialog.tsx` / `src/chart-style.css` | 外观模型、持久化、实时预览与设置窗口 |
| `src/roi-cursor.ts` | 矩形八个控制点的缩放指针映射 |
| `src/panel-layout.tsx` | 面板尺寸、可拖拽分隔条与布局记忆 |
| `src/image-stage.tsx` | Canvas 图像、旋转、缩放、ROI 和参考线交互 |
| `src/core.ts` | 单位换算、取整限幅、ROI 扫描线选择、统计和直方图 |
| `src/compute.worker.ts` | 后台解码、处理、统计缓存与导出队列 |
| `src/worker-client.ts` | 主线程与 Worker 通讯 |
| `src/image-io.ts` | 保留位深的 PNG/TIFF/BMP 编解码及浏览器 JPEG 编解码 |
| `src/export-data.ts` | TXT、逐行 XLSX、图片及 ZIP 输出 |
| `src/export-naming.ts` | 五项导出成组编号 |
| `src/histogram.tsx` | 主视图与独立窗口共用的清晰绘图、可复制摘要及 4K PNG |
| `src/histogram-draw.ts` | 图表绘制、文字格式和导出共用的独立渲染函数 |
| `src/action-icons.tsx` | Calculate 的 Function 图标和两个 Import 按钮共用的导入图标 |
| `src/histogram.css` | 网页与独立图表的布局 |
| `src/canvas-resolution.ts` | 按所属窗口的尺寸与 DPR 设置画布分辨率 |
| `src/app-dialogs.tsx` / `src/app-dialogs.css` | Help 分章说明、About 信息卡和随机古诗文 |
| `src/poetry.ts` | 在线诗句、预取、近期去重与离线兜底 |

原始样本与处理后 DN 保存在 Worker 的 Uint8/Uint16/Uint32 数组中；统计使用 JavaScript Number（IEEE 754 双精度）。ROI 采用逐行区间，避免整幅二维逻辑掩膜和每像素坐标表。只修改光学参数或直方图范围时复用 ROI 统计。预览缩小但计算保持全分辨率；高倍率缩放请求当前可视区域的原分辨率图块。XLSX 按行生成压缩 XML，避免每个像素创建一个单元格对象。

导入的图像文件和结果不提交服务器。网站本身可托管；图像处理、计算和文件生成均在访问者浏览器完成。

## 本地运行与维护

验证环境为 Windows、Node.js 24.19.0、pnpm 11.25.0。依赖版本固定在 `package.json` / `pnpm-lock.yaml`。

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
pnpm benchmark
```

开发地址 `http://127.0.0.1:5178/`。`dist/` 为静态发布目录，也可放在其他静态服务器上。应通过 HTTP/HTTPS 访问，不能直接双击 HTML 使用 Worker。应用无需 MATLAB、Python、相机工具箱或后端服务。

## GitHub Pages 自动部署

推送到 `main` 后，`.github/workflows/pages.yml` 自动安装固定版本依赖、运行数值与导出测试、构建并发布 GitHub Pages。仓库的 `Settings → Pages → Source` 使用 `GitHub Actions`。构建时根据仓库名称设置资源基础路径，示例图片和计算 Worker 也从该子路径加载。本地构建仍使用相对路径，可独立部署到其他静态服务器。

若仓库改名，工作流会自动采用新名称；同时更新本说明顶部的网页和仓库链接。

## 验证和格式边界

见 [verification/VERIFICATION.md](verification/VERIFICATION.md)：42 组 MATLAB 对照、17 份压缩/索引格式样本、浏览器交互与真实导出重读，以及相同机器上的 CPU 核心基准。

已验证常见无损 8/16 位灰度 PNG、BMP、单幅 TIFF，以及 32 位无符号条带 TIFF 的无压缩/LZW/Deflate/PackBits。输入必须是不透明灰度图像。BigTIFF、不受支持的 TIFF 方向、32 位分块 TIFF 和未实现的压缩方式会明确报错。TIFF 使用第一幅图。Excel 的单张表限制为 1,048,576 行 × 16,384 列。大型图片和导出仍受浏览器可用内存约束。尚未用用户相机的真实原始图像进行验证。
