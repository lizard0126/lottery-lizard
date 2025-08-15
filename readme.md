# koishi-plugin-lottery-lizard

[![npm](https://img.shields.io/npm/v/koishi-plugin-lottery-lizard?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-lottery-lizard)

# 🎲 lottery-lizard 插件使用说明
提供群聊大乐透玩法、开奖与积分分配，附赠刮刮乐小游戏！

<details>
<summary><strong><span style="font-size: 1.3em; color: #2a2a2a;">大乐透玩法说明</span></strong></summary>

### 玩法简介：

- 每次下注消耗至少 <code>20积分</code>，选择 1~18 中的 7 个数字下注。
- 前 5 个数字为“前区”（不能重复），后 2 个为“后区”（可重复）。
- 每人可多次下注，全部独立结算。
- 开奖后按照前区命中数量 <strong>加权分配奖池</strong>。
- 后区每猜中 1 个，固定奖励 <code>5积分</code>。
- 参与人数大于 3 人后，每多 1 人，奖池额外 +5积分。

---

### 指令说明：

#### 查看当前群聊大乐透下注情况：
- 显示当前下注次数、奖池积分、下注号码列表
<pre style="background-color: #f4f4f4; padding: 10px; border-radius: 4px; border: 1px solid #ddd;">大乐透</pre>

#### 进行一次大乐透下注：
- 不输入下注的积分则默认消耗20
<pre style="background-color: #f4f4f4; padding: 10px; border-radius: 4px; border: 1px solid #ddd;">大乐透.下注 25</pre>
- 下注后跟根据提示输入下注号码，数字范围为 1~18，前 5 个不能重复，后 2 个可重复
<pre style="background-color: #f4f4f4; padding: 10px; border-radius: 4px; border: 1px solid #ddd;">1 2 3 4 5 1 1</pre>

#### 开奖：
- 自动生成开奖号码，结算所有下注者的奖励，中奖与否都可获得奖池份额
<pre style="background-color: #f4f4f4; padding: 10px; border-radius: 4px; border: 1px solid #ddd;">大乐透.开奖</pre>

---

#### 示例开奖机制：
- 前区命中 5 个：权重最高（奖池分最多）
- 前区命中 4 个：权重其次，以此类推
- 后区猜中每个号码：+5积分，固定奖励，不影响奖池

</details>

<details>
<summary><strong><span style="font-size: 1.3em; color: #2a2a2a;">刮刮乐说明</span></strong></summary>

### 玩法简介：

- 消耗 <code>5积分</code> 抽奖一次，系统自动返回中奖结果。可一次抽多张
- 获得的奖励直接发放到用户账户。

---

### 指令说明：
#### 购买刮刮乐：
- 默认购买1张，可选购买数量，即时返回结果
<pre style="background-color: #f4f4f4; padding: 10px; border-radius: 4px; border: 1px solid #ddd;">刮刮乐 5 // 购买5张刮刮乐</pre>

</details>

<details>
<summary><strong><span style="font-size: 1.3em; color: #2a2a2a;">如果要反馈建议或报告问题</span></strong></summary>

<strong>可以[点这里](https://github.com/lizard0126/lottery-lizard/issues)创建议题~</strong>
</details>

<details>
<summary><strong><span style="font-size: 1.3em; color: #2a2a2a;">如果喜欢我的插件</span></strong></summary>

<strong>可以[请我喝可乐](https://ifdian.net/a/lizard0126)，没准就有动力更新新功能了~</strong>
</details>