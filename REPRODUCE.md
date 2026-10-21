# 从新目录复跑

本包使用原 npm 1.3.3，不改源码。仅在独立目录构造真实 DSH profile 和浏览器；文件故障只作用于该测试目录。

1. 准备 Node、Python、DSH CLI、Playwright、Edge/Chromium。
2. 把 `repro/config.example.json` 复制到包外的 `config.local.json`，填写四个真实工具路径。不要提交本地配置。
3. 在当前包根目录执行：

```powershell
python -X utf8 -B ./repro/replay.py --config C:/YOUR/config.local.json --run-root C:/YOUR/NEW_EMPTY_RUN
```

`--run-root` 必须尚不存在；脚本不会覆盖历史轮次。
预期进程 exit 0，`results/public-result.json` 中 completed=true：

- slider：输入框数 1 → 0 → 1（切页恢复）。
- http500：界面改值、宿主旧值、刷新回退；正常对照 UI/host 相同。
- realFileFault：真实写入故障，status=200、ok=true、readbackSettings=null。
- preview：8000×5334 原图出现在约131px卡片，预览字节数与原图相同。

exit 0 表示精确复现预期缺陷与对照，不表示产品无缺陷。
结果截图采集时遮罩路径；`private/` 下认证 URL、原始配置与日志不得公开。
宿主进程由脚本在 finally 中停止；如果强行结束测试，先检查本轮 private 备份，不要重跑覆盖。

测试不禁用 fsync。早期 Node permission 环境会禁止 fsync，属于环境差异，不使用它证明普通环境保存失败。
不修改系统壁纸或工坊文件；Steam 候选设置不排除真实库，因此可能只读枚举元数据，但仅选择合成上传图片。

本仓记录了脚本在新目录运行的结果。发布 ZIP 另有解压后复跑结果；不声称跨机器依赖安装全部已验。
