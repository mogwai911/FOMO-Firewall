<div align="center">
  <h1>FOMO Firewall</h1>
  <p><strong>每天 10 分钟，先筛掉噪音，再深入真正值得学的内容。</strong></p>

  <p>
    <img src="https://img.shields.io/github/stars/mogwai911/FOMO-Firewall?style=flat-square" alt="stars" />
    <img src="https://img.shields.io/github/license/mogwai911/FOMO-Firewall?style=flat-square" alt="license" />
    <img src="https://img.shields.io/github/last-commit/mogwai911/FOMO-Firewall?style=flat-square" alt="last commit" />
  </p>
</div>

FOMO Firewall 是一个帮助信息过载用户快速完成“去学习 / 稍后看 / 忽略”决策，并沉淀长期洞察的工具。

---

## 快速导航

- [效果展示](#效果展示)
- [你可以做什么](#你可以做什么)
- [30 秒开始](#30-秒开始)
- [配置说明小白版](#配置说明小白版)
- [常见问题](#常见问题)

---

## 效果展示

![日报处置界面](.github/readme/preview-digest.png)
上图展示了你如何在一个页面里完成每日信息分流。

![学习会话界面](.github/readme/preview-session.png)
上图展示了你如何围绕单条资讯持续追问并深化理解。

![记忆库界面](.github/readme/preview-memory.png)
上图展示了你如何回看洞察、证据和会话轨迹。

---

## 你可以做什么

- 你可以把多个订阅源合并到同一份日报里，统一判断优先级。  
- 你可以按“去学习 / 稍后看 / 忽略”快速分流，降低注意力消耗。  
- 你可以进入学习会话持续提问，把“知道”变成“理解和可执行”。  
- 你可以把学习结果沉淀成洞察卡，后续快速回忆和复盘。  
- 你可以按自己的偏好调整提示词和模型，让助手更贴合你。  

---

## 30 秒开始

开始前你需要准备：
- Docker Desktop（已安装并运行）

### 方式 A（推荐）：直接拉镜像运行

```bash
docker run -d --name fomo-firewall -p 3000:3000 -v fomo_firewall_data:/app/data ghcr.io/mogwai911/fomo-firewall:latest
```

然后打开：`http://localhost:3000`

### 方式 B：本地构建运行

```bash
cp .env.example .env
docker compose up -d --build
```

然后打开：`http://localhost:3000`

---

## 配置说明小白版

- `模型地址`：你要连接哪个模型服务。  
- `服务密钥`：你的模型服务密钥。  
- `APP_SETTINGS_ENCRYPTION_KEY`：只用于把密钥加密后保存在你本机。  
  如果你用 Docker 一键启动，这个值会自动生成并持久化，无需手动填写。  

---

## 常见问题

**Q: 打开后看不到日报内容？**  
A: 先去“设置”添加订阅源，再回到“日报处置”点击“更新日报”。  

**Q: 一定要先填模型密钥吗？**  
A: 不一定。你可以先体验流程，后续再补模型配置。  

**Q: 需要付费吗？**  
A: 项目本身不强制付费；模型调用是否收费取决于你使用的模型服务。  

**Q: 我的数据会上传吗？**  
A: 默认只保存在你本机 Docker 数据卷里，不会自动上传。  

**Q: 启动失败怎么办？**  
A: 先确认 Docker Desktop 正在运行；然后执行 `docker logs fomo-firewall` 查看错误。  

---

## License

MIT
