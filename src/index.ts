import { Context, Schema, Random, h } from 'koishi'

export const inject = ['database', 'monetary']
export const name = 'lottery-lizard'

export const usage = `
# 🎲 lottery-lizard 插件使用说明
提供群聊大乐透玩法、开奖与积分分配，附赠刮刮乐小游戏！

<details>
<summary><strong><span style="font-size: 1.3em; color: #2a2a2a;">🎯 大乐透玩法说明</span></strong></summary>

<strong>玩法简介：</strong>

- 每次下注消耗 <code>20积分</code>，选择 1~18 中的 7 个数字下注。
- 前 5 个数字为“前区”（不能重复），后 2 个为“后区”（可重复）。
- 每人可多次下注，全部独立结算。
- 开奖后按照前区命中数量 <strong>加权分配奖池</strong>。
- 后区每猜中 1 个，固定奖励 <code>5积分</code>。
- 参与人数大于 3 人后，每多 1 人，奖池额外 +5积分。

---

📌 <strong>指令说明：</strong>

### 查看当前群聊大乐透下注情况：
#### 显示当前下注次数、奖池积分、下注号码列表
<pre style="background-color: #f4f4f4; padding: 10px; border-radius: 4px; border: 1px solid #ddd;">大乐透</pre>

### 进行一次大乐透下注（每次消耗 20 积分）：
#### 数字范围为 1~18，前 5 个不能重复，后 2 个可重复。支持多次下注。
<pre style="background-color: #f4f4f4; padding: 10px; border-radius: 4px; border: 1px solid #ddd;">大乐透.下注 1 3 5 7 9 2 2</pre>

### 开奖（管理员或特殊权限触发）：
#### 自动生成开奖号码，结算所有下注者的奖励，中奖与否都可获得奖池份额。
<pre style="background-color: #f4f4f4; padding: 10px; border-radius: 4px; border: 1px solid #ddd;">大乐透.开奖</pre>

---

📎 示例开奖机制：
- 前区命中 5 个：权重最高（奖池分最多）
- 前区命中 4 个：权重其次，以此类推
- 后区猜中每个号码：+5积分，固定奖励，不影响奖池

</details>

<details>
<summary><strong><span style="font-size: 1.3em; color: #2a2a2a;">🧧 刮刮乐说明</span></strong></summary>

<strong>玩法简介：</strong>

- 每次消耗 <code>5积分</code> 抽奖一次，系统自动返回中奖结果。
- 获得的奖励直接发放到用户账户。

🎁 奖励池概率如下：

| 奖励名称   | 概率   | 奖励金额       |
|------------|--------|----------------|
| 💎 终极大奖 | 0.01% | 4999 积分      |
| 🏆 黄金大奖 | 0.1%  | 1000 积分      |
| 🎉 超大奖   | 1%    | 100 积分       |
| 🍀 欧皇奖   | 1%    | 50 积分        |
| 🍀 幸运奖   | 1%    | 30 积分        |
| 🎁 快乐奖   | 2%    | 20 积分        |
| 🪙 保底奖   | 45%   | 5 积分         |
| 🍂 安慰奖   | 10%   | 2 积分         |
| ❌ 未中奖   | 40.89%| 0 积分         |

📌 指令示例：
<pre style="background-color: #f4f4f4; padding: 10px; border-radius: 4px; border: 1px solid #ddd;">刮刮乐</pre>

</details>

<details>
<summary><strong><span style="font-size: 1.3em; color: #2a2a2a;">如果要反馈建议或报告问题</span></strong></summary>

<strong>可以[点这里](https://github.com/lizard0126/lottery-lizard/issues)创建议题~</strong>
</details>

<details>
<summary><strong><span style="font-size: 1.3em; color: #2a2a2a;">如果喜欢我的插件</span></strong></summary>

<strong>可以[请我喝可乐](https://ifdian.net/a/lizard0126)，没准就有动力更新新功能了~</strong>
</details>
`

export interface Config {
  currency: string
}

export const Config: Schema<Config> = Schema.object({
  currency: Schema.string().default('积分').description('monetary 中的 currency 字段名称'),
})

declare module 'koishi' {
  interface Tables {
    monetary: {
      uid: number;
      currency: string;
      value: number;
    }
    lotto: {
      id: string
      uid: number
      channelId: string
      numbers: {
        front: number[]
        back: number[]
      }
    }
  }
}

export function apply(ctx: Context, config: Config) {
  const currency = config.currency
  const logger = ctx.logger(name)

  ctx.model.extend('lotto', {
    id: 'string',
    uid: 'unsigned',
    channelId: 'string',
    numbers: 'json',
  }, {
    primary: 'id',
  })

  async function updateUserCurrency(uid, change: number): Promise<boolean> {
    try {
      const [row] = await ctx.database.get('monetary', { uid, currency })
      const newValue = row.value + change
      await ctx.database.set('monetary', { uid, currency }, { value: newValue });
      return true
    } catch (e) {
      logger.error(`更新用户${uid}的${currency}失败:`, e)
      return false
    }
  }

  const dlt = ctx.command('大乐透', '来一局大乐透')
  dlt
    .action(async ({ session }) => {
      const channelId = session.channelId
      const bets = await ctx.database.get('lotto', { channelId })
      let msg = (
        `大乐透规则：\n` +
        `每次下注需消耗20${currency}，选择1~18中的7个号码：前5个不能重复，后2个可重复\n\n` +
        `开奖后根据前5个猜中数量数进行加权分配奖池，后两个每猜中一个固定奖励5${currency}。\n\n` +
        `若参与人数大于3，每多一个人奖池增加5${currency}，每人可多次下注，独立计算奖励。\n\n`
      )
      if (bets.length === 0) {
        msg += '当前群聊暂无大乐透下注记录。'
        return msg
      }

      const totalPool = bets.length * 20
      const uniqueUids = new Set(bets.map(bet => bet.uid))
      const extra = Math.max(uniqueUids.size - 3, 0) * 5
      const pool = totalPool + extra

      const userNumbers: string[] = []
      for (const bet of bets) {
        const [user] = await ctx.database.get("binding", { aid: bet.uid })
        const front = bet.numbers.front.join(', ')
        const back = bet.numbers.back.join(', ')
        userNumbers.push(`【${front} | ${back}】`)
      }

      msg += (
        `当前${uniqueUids.size}人下注，共下注${bets.length}次\n` +
        `当前奖池总额：${pool}${currency}\n\n` +
        `当前存在号码：\n` +
        userNumbers.join(', \n')
      )

      return msg
    })

  dlt
    .subcommand('.下注 <nums:text>', '下注大乐透（格式如：1 3 5 7 9 2 2）')
    .userFields(['id'])
    .action(async ({ session }, nums) => {
      const uid = session.user.id
      const channelId = session.channelId
      const [row] = await ctx.database.get('monetary', { uid, currency });

      if (!row) {
        await ctx.database.create('monetary', { uid, currency, value: 5 })
        await session.send(`你还没有${currency}记录，已为你赠送5${currency}作为初始资金。`)
        return
      }

      if (row.value < 20) {
        return `你的${currency}不足（需要20${currency}）`
      }

      const parts = nums?.split(/\s+/).map(s => parseInt(s)).filter(n => !isNaN(n) && n >= 1 && n <= 35)
      if (!parts || parts.length !== 7) {
        return '请输入 7 个 1~18 之间的数字，前 5 个不可重复，后 2 个可重复，用空格隔开'
      }

      const front = parts.slice(0, 5)
      const back = parts.slice(5)

      if (new Set(front).size !== 5) {
        return '前区号码不能重复，请重新输入 5 个不同的数字。'
      }

      await updateUserCurrency(uid, -20)

      await ctx.database.create('lotto', {
        id: Date.now().toString(),
        uid,
        channelId,
        numbers: {
          front,
          back
        }
      })

      return `你成功下注号码：前区【${front.join(', ')}】，后区【${back.join(', ')}】（扣除20${currency}）`
    })

  dlt
    .subcommand('.开奖', '开奖并分配奖池')
    .action(async ({ session }) => {
      const channelId = session.channelId
      const bets = await ctx.database.get('lotto', { channelId })

      if (bets.length === 0) {
        return '当前没有下注记录。'
      }

      let pool = bets.length * 20
      const uniqueUids = new Set(bets.map(bet => bet.uid))
      const extra = Math.max(uniqueUids.size - 3, 0) * 5
      pool += extra

      const frontResult = Random.shuffle(Array.from({ length: 18 }, (_, i) => i + 1)).slice(0, 5).sort((a, b) => a - b)
      const backResult = Random.shuffle(Array.from({ length: 18 }, (_, i) => i + 1)).slice(0, 2).sort((a, b) => a - b)

      const weightMap = new Map<number, number>()
      const backBonusMap = new Map<number, number>()

      for (const { uid, numbers } of bets) {
        const frontHit = numbers.front.filter(n => frontResult.includes(n)).length
        const backHit = numbers.back.filter(n => backResult.includes(n)).length

        let weight = 0
        if (frontHit === 5) weight = 80
        else if (frontHit === 4) weight = 40
        else if (frontHit === 3) weight = 20
        else if (frontHit === 2) weight = 10
        else if (frontHit === 1) weight = 5
        else weight = 1

        weightMap.set(uid, (weightMap.get(uid) || 0) + weight)
        backBonusMap.set(uid, (backBonusMap.get(uid) || 0) + backHit * 5)
      }

      const totalWeight = Array.from(weightMap.values()).reduce((a, b) => a + b, 0)
      let resultMsg = (
        `开奖号码：前区【${frontResult.join(', ')}】\n后区【${backResult.join(', ')}】\n` +
        `总奖池：${pool}${currency}\n`)

      for (const [uid, weight] of weightMap.entries()) {
        const gain = Math.ceil(pool * (weight / totalWeight))
        const bonus = backBonusMap.get(uid) || 0
        const totalGain = gain + bonus

        await updateUserCurrency(uid, gain)

        const [user] = await ctx.database.get("binding", { aid: uid })
        resultMsg += (`积分分配：` + h('at', { id: user.pid }) + ` 获得${totalGain}${currency}\n`)
      }

      await ctx.database.remove('lotto', { channelId })
      await session.send(resultMsg)
      return
    })

  ctx.command('刮刮乐', `花 5 ${currency}来张刮刮乐，最高可得4999！`)
    .userFields(['id'])
    .action(async ({ session }) => {
      const uid = session.user.id
      const [row] = await ctx.database.get('monetary', { uid, currency });

      if (!row) {
        await ctx.database.create('monetary', { uid, currency, value: 5 })
        await session.send(`你还没有${currency}记录，已为你赠送5${currency}作为初始资金。`)
        return
      }

      if (row.value < 5) {
        return `你的${currency}不足（需要5${currency}）`
      }

      const deductSuccess = await updateUserCurrency(uid, -5)
      if (!deductSuccess) {
        return `购买失败，请稍后再试`
      }

      await session.sendQueued(`你花费5${currency}购买了一张彩票，刮开涂层...`)
      await new Promise(resolve => setTimeout(resolve, 3000))

      const r = Math.random()
      let reward = 0
      let msg = '很遗憾，这次没有中奖'

      if (r < 0.0001) {         // 0.01%
        reward = 4999
        msg = `🎉 终极大奖！获得4999${currency}！`
      } else if (r < 0.0011) {  // 0.1%
        reward = 1000
        msg = `🎉 黄金大奖！获得1000${currency}！`
      } else if (r < 0.0111) {  // 1%
        reward = 100
        msg = `🎉 刮中大奖！获得100${currency}！`
      } else if (r < 0.0211) {  // 1%
        reward = 50
        msg = `🎉 欧皇奖！获得50${currency}！`
      } else if (r < 0.0311) {  // 1%
        reward = 30
        msg = `🎉 幸运奖！获得30${currency}！`
      } else if (r < 0.0511) {  // 2%
        reward = 20
        msg = `🎉 快乐奖！获得20${currency}！`
      } else if (r < 0.4511) {  // 40%
        reward = 5
        msg = `🎉 再来一张！返还5${currency}！`
      } else if (r < 0.5511) {  // 10%
        reward = 2
        msg = `🎉 安慰奖！获得2${currency}！`
      }

      if (reward > 0) {
        const rewardSuccess = await updateUserCurrency(uid, reward)
        if (!rewardSuccess) {
          msg += '\n奖励发放失败，请联系管理员'
        }
      }

      return msg
    })
}