import { Context, Schema, Random, h } from 'koishi'

export const inject = ['database', 'monetary']
export const name = 'lottery-lizard'

export const usage = `
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

- 消耗积分购买一次刮刮乐，系统自动返回中奖结果。可一次购买多张
- 限制一次最多购买数量，由于方差太大，购买数量过高时会导致盈利概率飙升
- 可以参考控制台给出的期望方差等信息调整奖项权重设置

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
`

export interface Config {
  currency: string
  prizes: { prob: number; reward: number; name: string }[]
  costPerTicket: number
  maxTicketCount: number
  logExpectation?: boolean
}

export const Config: Schema<Config> = Schema.object({
  currency: Schema.string().default('default').description('monetary 中的 currency 字段名称'),
  prizes: Schema.array(
    Schema.object({
      prob: Schema.number().description('中奖概率权重'),
      reward: Schema.number().description('中奖金额'),
      name: Schema.string().description('奖项名称'),
    })
  ).role('table').description('刮刮乐奖项设置').default([
    { prob: 1, reward: 4999, name: '天选之人' },
    { prob: 5, reward: 1000, name: '至尊欧皇' },
    { prob: 100, reward: 100, name: '欧洲人' },
    { prob: 300, reward: 50, name: '疯狂星期四' },
    { prob: 800, reward: 30, name: '运气爆棚' },
    { prob: 1000, reward: 20, name: '狗屎运' },
    { prob: 80000, reward: 5, name: '再来一张' },
    { prob: 6000, reward: 2, name: '安慰奖' },
  ]),
  costPerTicket: Schema.number().min(1).default(5).description('刮刮乐每张的价格'),
  maxTicketCount: Schema.number().min(1).default(10).description('最多一次购买的刮刮乐数量'),
  logExpectation: Schema.boolean().default(false).description('更新刮刮乐奖项后是否在控制台输出数学期望'),
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
      cost: number
    }
  }
}

function calcPoolFromDB(bets: any[]) {
  const basePool = bets.reduce((sum, bet) => sum + (bet.cost || 0), 0)
  const uniqueUids = new Set(bets.map(bet => bet.uid))
  const extra = Math.max(uniqueUids.size - 3, 0) * 5
  return basePool + extra
}

function drawPrize(prizes) {
  const totalWeight = prizes.reduce((sum, p) => sum + p.prob, 0)
  let r = Math.random() * totalWeight
  for (const p of prizes) {
    if (r < p.prob) return p
    r -= p.prob
  }
}

function updateExpectation(ctx: Context, config: Config) {
  const prizes = config.prizes || []
  const totalProb = prizes.reduce((sum, p) => sum + p.prob, 0)

  if (totalProb <= 0) {
    ctx.logger.warn('奖项概率总和为 0，无法计算期望')
    return
  }

  const pList = prizes.map(p => ({
    ...p,
    probability: p.prob / totalProb,
  }))
  const expectation = pList.reduce((sum, p) => sum + p.probability * p.reward, 0)
  const variance = pList.reduce((sum, p) => sum + p.probability * Math.pow(p.reward - expectation, 2), 0)

  const hitRates = pList.map(p => `${p.name}: ${(p.probability * 100).toFixed(3)}%`).join(', ')

  function pmfSingle() {
    const m = new Map<number, number>()
    for (const p of pList) {
      m.set(p.reward, (m.get(p.reward) || 0) + p.probability)
    }
    return m
  }
  function convolve(a: Map<number, number>, b: Map<number, number>) {
    const c = new Map<number, number>()
    for (const [ra, pa] of a) {
      for (const [rb, pb] of b) {
        const r = ra + rb
        c.set(r, (c.get(r) || 0) + pa * pb)
      }
    }
    return c
  }
  function pmfNTickets(n: number) {
    let cur = pmfSingle()
    for (let i = 2; i <= n; i++) {
      cur = convolve(cur, pmfSingle())
    }
    return cur
  }
  const totalCost = config.costPerTicket * config.maxTicketCount

  const pmf10 = pmfNTickets(config.maxTicketCount)
  let loseRate = 0, tieRate = 0, winRate = 0
  for (const [sumReward, prob] of pmf10) {
    if (sumReward < totalCost) loseRate += prob
    else if (sumReward === totalCost) tieRate += prob
    else winRate += prob
  }

  if (config.logExpectation) {
    ctx.logger.info(`单张数学期望: ${expectation.toFixed(3)}`)
    ctx.logger.info(`单张方差: ${variance.toFixed(3)}`)
    ctx.logger.info(`各档单次命中率: ${hitRates}`)
    ctx.logger.info(`买 ${config.maxTicketCount} 张（总成本 ${totalCost}）概率分布:`)
    ctx.logger.info(`亏损率: ${(loseRate * 100).toFixed(2)}%`)
    ctx.logger.info(`平手率: ${(tieRate * 100).toFixed(2)}%`)
    ctx.logger.info(`盈利率: ${(winRate * 100).toFixed(2)}%`)
  }
}

export function apply(ctx: Context, config: Config) {
  ctx.on(`config:${name}` as any, (newConfig: Config) => {
    updateExpectation(ctx, newConfig)
  })

  updateExpectation(ctx, config)

  const currency = config.currency
  const logger = ctx.logger(name)

  ctx.model.extend('lotto', {
    id: 'string',
    uid: 'unsigned',
    channelId: 'string',
    numbers: 'json',
    cost: 'unsigned'
  }, {
    primary: 'id',
  })

  async function updateUserCurrency(uid: number, change: number): Promise<boolean> {
    try {
      const rows = await ctx.database.get('monetary', { uid, currency })
      const row = Array.isArray(rows) ? rows[0] : rows
      if (!row) {
        if (change < 0) return false
        await ctx.database.create('monetary', { uid, currency, value: change })
        return true
      }
      const newValue = row.value + change
      if (newValue < 0) return false
      await ctx.database.set('monetary', { uid, currency }, { value: newValue })
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
        `每次下注需消耗${currency}，选择1~18中的7个号码：前5个不能重复，后2个可重复\n\n` +
        `开奖后根据前5个猜中数量数进行加权分配奖池，后两个每猜中一个固定奖励5${currency}。\n\n` +
        `若参与人数大于3，每多一个人奖池增加5${currency}，每人可多次下注，独立计算奖励。\n\n`
      )
      if (bets.length === 0) {
        msg += '当前群聊暂无大乐透下注记录。'
        return msg
      }

      const pool = calcPoolFromDB(bets)

      const userNumbers: string[] = []
      for (const bet of bets) {
        const [user] = await ctx.database.get("binding", { aid: bet.uid })
        const front = bet.numbers.front.join(', ')
        const back = bet.numbers.back.join(', ')
        userNumbers.push(`【${front} | ${back}】`)
      }

      msg += (
        `当前${new Set(bets.map(b => b.uid)).size}人下注，共下注${bets.length}次\n` +
        `当前奖池总额：${pool}${currency}\n\n` +
        `当前下注号码：\n` +
        userNumbers.join(', \n')
      )

      return msg
    })

  dlt
    .subcommand('.下注 [money]', `下注大乐透，最低花费20${currency}`)
    .userFields(['id'])
    .action(async ({ session }, money) => {
      const uid = session.user.id
      const channelId = session.channelId
      const [row] = await ctx.database.get('monetary', { uid, currency });

      let cost = 20
      if (money) {
        const parsed = parseInt(String(money), 10)
        if (Number.isNaN(parsed) || parsed < 20) {
          return `请正确输入下注金额（至少20${currency}）。`
        }
        cost = parsed
      }

      if (!row) {
        await ctx.database.create('monetary', { uid, currency, value: 20 })
        await session.send(`你还没有${currency}记录，已为你赠送20${currency}作为初始资金。`)
        return
      }

      const latest = (await ctx.database.get('monetary', { uid, currency }))?.[0]
      if (!latest || latest.value < cost) {
        return `你的${currency}不足（需要至少${cost}${currency}）`
      }

      await session.send(`请输入下注号码：7个1~18之间的数字，前5个不可重复，后2个可重复，用空格隔开`);
      const num = await session.prompt(30000);
      if (!num) return '已取消下注';
      const parts = num?.split(/\s+/).map(s => parseInt(s)).filter(n => !isNaN(n) && n >= 1 && n <= 18)
      if (parts.length !== 7) return '请输入 7 个 1~18 之间的数字，前 5 个不可重复，后 2 个可重复，用空格隔开'

      const front = parts.slice(0, 5)
      const back = parts.slice(5)
      if (new Set(front).size !== 5) return '前区号码不能重复，请重新输入 5 个不同的数字。'

      await updateUserCurrency(uid, -cost)

      await ctx.database.create('lotto', {
        id: `${Date.now()}`,
        uid, channelId,
        numbers: { front, back },
        cost
      })

      return `你成功下注号码：前区【${front.join(', ')}】，后区【${back.join(', ')}】（扣除${cost}${currency}）`
    })

  dlt
    .subcommand('.开奖', '开奖并分配奖池')
    .action(async ({ session }) => {
      const channelId = session.channelId
      const bets = await ctx.database.get('lotto', { channelId })

      if (bets.length === 0) {
        return '当前没有下注记录。'
      }

      const pool = calcPoolFromDB(bets)

      const frontResult = Random.shuffle(Array.from({ length: 18 }, (_, i) => i + 1)).slice(0, 5).sort((a, b) => a - b)
      const backResult = Random.shuffle(Array.from({ length: 18 }, (_, i) => i + 1)).slice(0, 2).sort((a, b) => a - b)

      const weightMap = new Map<number, number>()
      const backBonusMap = new Map<number, number>()

      for (const { uid, numbers } of bets) {
        const frontHit = numbers.front.filter(n => frontResult.includes(n)).length
        const backHit = numbers.back.filter(n => backResult.includes(n)).length

        const weightTable = { 5: 80, 4: 40, 3: 20, 2: 10, 1: 5, 0: 1 }
        const weight = weightTable[frontHit] ?? 1

        weightMap.set(uid, (weightMap.get(uid) || 0) + weight)
        backBonusMap.set(uid, (backBonusMap.get(uid) || 0) + backHit * 5)
      }

      const totalWeight = Array.from(weightMap.values()).reduce((a, b) => a + b, 0)
      let resultMsg = (
        `开奖号码：前区【${frontResult.join(', ')}】\n后区【${backResult.join(', ')}】\n` +
        `总奖池：${pool}${currency}\n`
      )

      for (const [uid, weight] of weightMap.entries()) {
        const gain = Math.ceil(pool * (weight / totalWeight))
        const bonus = backBonusMap.get(uid) || 0
        const totalGain = gain + bonus

        await updateUserCurrency(uid, totalGain)

        const [user] = await ctx.database.get("binding", { aid: uid })
        resultMsg += (`积分分配：` + h('at', { id: user.pid }) + ` 获得${totalGain}${currency}\n`)
      }

      await ctx.database.remove('lotto', { channelId })
      await session.send(resultMsg)
      return
    })

  ctx.command('刮刮乐 [count:number]', `花5${currency}来张刮刮乐，最高可得4999！`)
    .userFields(['id'])
    .action(async ({ session }, count = 1) => {
      count = Math.max(1, Math.floor(count))
      if (count > config.maxTicketCount) await session.send(`一次最多只能购买${config.maxTicketCount}张刮刮乐！`)
      count = Math.min(count, config.maxTicketCount)

      const uid = session.user.id
      const [row] = await ctx.database.get('monetary', { uid, currency });

      if (!row) {
        await ctx.database.create('monetary', { uid, currency, value: 20 })
        return `你还没有${currency}记录，已为你赠送20${currency}作为初始资金。`
      }

      const cost = config.costPerTicket * count
      if (row.value < cost) {
        return `你的${currency}不足（需要${cost}${currency}）`
      }

      const deductSuccess = await updateUserCurrency(uid, -cost)
      if (!deductSuccess) return `购买失败，请稍后再试`

      await session.sendQueued(`你花费${cost}${currency}购买了${count}张刮刮乐，刮开涂层中…`)
      await new Promise(resolve => setTimeout(resolve, 3000))

      let totalReward = 0
      let stats = {}
      for (let p of config.prizes) stats[p.name] = 0

      for (let i = 0; i < count; i++) {
        const prize = drawPrize(config.prizes)
        stats[prize.name]++
        totalReward += prize.reward
      }

      await updateUserCurrency(uid, totalReward)

      return `本次刮出：\n${Object.entries(stats)
        .filter(([_, v]) => (v as number) > 0)
        .map(([name, cnt]) => `${name} × ${cnt}`)
        .join('\n')}\n\n总中奖金额：${totalReward}${currency}`
    })
}