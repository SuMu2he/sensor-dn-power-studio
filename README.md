# Sensor DN Power Studio

[Open the web app](https://sumu2he.github.io/sensor-dn-power-studio/) · [GitHub repository](https://github.com/SuMu2he/sensor-dn-power-studio)

无需安装、无需登录。浏览器本地处理图像；源码公开不会上传使用者导入的图片。

MATLAB `MoirePowerDensityApp` 的独立网页版本。所有操作界面使用英文；参考 Binary Mask Studio 的浅色、深绿和荧光绿视觉风格。原 MATLAB 程序与参考网站不受影响。

## 使用

1. `Import` 导入 PNG、TIFF、BMP 或灰度 JPEG；也可将文件拖入网页。首次可使用 `Try a synthetic sample`。
2. `Preprocessing` 输入 Ka、Kb。计算数据统一为 `clip(round(Ka × raw DN + Kb), 0, 2^bitDepth − 1)`。越界数据自动限制到上下限，并在本区显示红色说明。
3. `Rectangle` 拖出绿色矩形，输入 W/H 或拖动控制点调整；中间的锁定按钮保持长宽比。`Polygon` 逐点绘制，Enter、双击或点击起点完成；Esc 取消，Backspace 撤销最后一个点。完成后可以拖动顶点和整个 ROI。
4. 输入 `Parameters`，点击 `Calculate`。只有点击 `Export` 才保存文件。
5. `Path` 可在支持 File System Access API 的浏览器中选择目录；未选择目录或浏览器不支持时，`Export` 下载包含五项结果的 ZIP。

滚轮悬停缩放，左键拖动背景平移，双击背景或 `Fit` 适应视图。`Angle` 仅旋转视图，`Reset` 将角度归零。图像计算和导出均使用原始方向的完整像素。

参考线可拖动；V/H 添加，Clear 清除，Guides 隐藏/显示，右键参考线可删除。`Contrast` 仅将显示范围映射到当前最小/最大 DN，保持计算和保存数据不变。

左侧五个区块始终保持 334 px 宽、92/148/246/254/140 px 高和 8 px 间隔，Save 下的空白边框区吸收剩余高度。较矮窗口使用侧栏滚动；较窄窗口的图像工具条横向滚动，保持三组按钮尺寸。

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
| `<prefix>_001_histogram.png` | 2400 × 1220 像素柱状图 |

矩阵为原图坐标中的 ROI 包围矩阵，未入选位置是 `NaN`；Excel 中显式写入文本 `NaN`。所有有限 DN 均为取整和限幅后的数据。图片沿用原文件扩展名/格式；ROI 标记图为 RGB。JPEG 再保存具有其固有的有损压缩，TXT/XLSX 和无损图片更适合逐像素比较。

选择目录后，只要一个同组目标文件已存在，就跳过整组编号，避免覆盖不完整导出。ZIP 模式通过当前站点的浏览器本地记录递增编号；网页没有权限扫描未授权的 Downloads 文件夹，清除站点数据后该记录也会清除。

## 架构与优化

| 文件 | 责任 |
|---|---|
| `src/main.tsx` | 界面、参数、操作和状态；修改按钮文字可从此开始 |
| `src/style.css` | 颜色、固定侧栏、控件尺寸与分组布局 |
| `src/image-stage.tsx` | Canvas 图像、旋转、缩放、ROI 和参考线交互 |
| `src/core.ts` | 单位换算、取整限幅、ROI 扫描线选择、统计和直方图 |
| `src/compute.worker.ts` | 后台解码、处理、统计缓存与导出队列 |
| `src/worker-client.ts` | 主线程与 Worker 通讯 |
| `src/image-io.ts` | 保留位深的 PNG/TIFF/BMP 编解码及浏览器 JPEG 编解码 |
| `src/export-data.ts` | TXT、逐行 XLSX、图片及 ZIP 输出 |
| `src/export-naming.ts` | 五项导出成组编号 |
| `src/histogram.tsx` | 双横轴柱状图、均值/峰值标注及 PNG |

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
