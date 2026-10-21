# Wallpaper Engine 1.3.3 前端体验补测

这是用户确认后的证据仓，不是插件官方仓库，也不是修复版本。
实测对象：`elysia395/dsh-wallpaper-engine`，固定提交 `01fbb8b8e66fd7e405e9c878d18dbd456187f111`。
插件 npm 包 SHA256：`52d7ababdccf0bfa289196914493af8d61a8802f253c9f6ceefe079e70421c67`。

## 主要记录

- [完整报告](REPORT.md)：真实文件写入失败仍回 200；HTTP 500 无未保存提示；滑块移除数字输入框；原图预览；窄屏与键盘体验。
- [原轮次汇总](RESULTS.json)、[版本来源](PROVENANCE.json)、[发表前刷新](PUBLICATION_REFRESH.json)。
- [公开脚本重跑结果](replay/source-run/public-result.json)：新配置、真实 DSH 和 Edge；只用合成 PNG。
- [运行方法](REPRODUCE.md)、[脱敏说明](SANITIZATION.json)。

## 范围

体验快测，不打总分、星级，不出正式能力五状态。滑块与图片预览已有上游报告，明确作为复核。
没有修改插件，没有调用模型或付费服务，没有复测先前安全报告，不认领绝对首报。
原生 Scene/Web/MP4/音频、长期性能、跨平台、屏幕阅读器未测。

截图来自测试页面，在采集时 mask 路径。没有上传账号 cookie、个人浏览器、原始认证日志、完整 DSH_HOME 或用户工坊素材。
Steam 环境变量只是优先候选，不排除主机已有库；复跑可能只读扫描库元数据，但界面筛选为图片，仅选合成上传件。
公开记录经过有清单的脱敏，不声称已上传全部原始字节。

同一份材料同步评测站与悬赏仓，仅申报一次贡献。自评 `medium/B`，最终由维护者裁定。
站内若强制快测填写能力判定，将保留冲突记录，不擅自改成“还说不准”。

## 发布件与许可证

`package/` 是已核验的原 npm 包，未改字节；插件许可证见 `licenses/wallpaper-engine-MIT.txt`，包内也含许可证。
`source-api/` 仅复制问题定位所需的上游源文件，遵循同一 MIT 许可。不是完整仓库 checkout。
复跑脚本在 `repro/`，不含本机配置。需要 Node、Python、已安装 DSH CLI、Playwright 和 Edge/Chromium。
