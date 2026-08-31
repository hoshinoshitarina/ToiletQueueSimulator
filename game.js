'use strict';

const SAVE_KEY = 'toiletQueueCrisisSaveV3';
const LEGACY_SAVE_KEY = 'toiletQueueCrisisSaveV2';
const TICK_MS = 50;
const SKILL_LABELS = { comfort: '安抚', rush: '催促' };
const SKILL_DROP_CHANCES = { '从容入厕': .5, '及时救援': .6, '极限抢救': .7, '千钧一发': .825 };
const ORIGINAL_BG = './img/background0.png';
const LOCAL_HOSTS = new Set(['localhost', '0.0.0.0', '::1', '[::1]']);
const IS_LOCAL_RUNTIME = window.location.protocol === 'file:' || LOCAL_HOSTS.has(window.location.hostname) || /^127\./.test(window.location.hostname);
const PORTRAIT_ASSET_STATES = ['', '-anxious', '-critical', '-extreme', '-relaxed'];

const AUDIO_FILES = {
  belly: Array.from({ length: 4 }, (_, i) => `./audio/belly_rumbling${i + 1}.ogg`),
  fart: Array.from({ length: 5 }, (_, i) => `./audio/fart${i + 1}.ogg`),
  diarrhea: Array.from({ length: 16 }, (_, i) => `./audio/Diarrhea${i + 1}.ogg`),
  flush: Array.from({ length: 2 }, (_, i) => `./audio/flush_the_toilet${i + 1}.ogg`),
  incontinence: Array.from({ length: 11 }, (_, i) => `./audio/incontinence${i + 1}.ogg`)
};

const AUDIO_COOLDOWNS = { belly: 1700, fart: 2300, diarrhea: 900, flush: 600, incontinence: 800 };
const audioState = { lastPlayed: {}, active: new Set() };

const BUILTIN_SCENES = [
  { id: 'park', name: '街心公园', toilets: { squat: 2, seated: 0 }, defaultCount: 8, desc: '【事故原因】社团野餐吃到了没烤熟的烤肉。公厕只有两个蹲厕，后续人群还在不断赶来。', bg: './img/background1.png' },
  { id: 'school', name: '私立学园', toilets: { squat: 2, seated: 1 }, defaultCount: 12, desc: '【事故原因】家政课误把泻药当成糖粉。下课铃响后，三波学生陆续冲向女厕所。', bg: './img/background2.png' },
  { id: 'comic', name: '夏日漫展', toilets: { squat: 3, seated: 1 }, defaultCount: 16, desc: '【事故原因】冷气、冰奶茶与繁复服装共同制造了危机，四个隔间很快排起长队。', bg: './img/background3.png' },
  { id: 'dorm', name: '女子宿舍', toilets: { squat: 0, seated: 1 }, defaultCount: 4, desc: '【事故原因】变态辣火锅的后遗症在清晨集中爆发，而整层楼只有一个马桶。', bg: './img/background4.png' },
  { id: 'mall', name: '新光百货', toilets: { squat: 3, seated: 2 }, defaultCount: 20, desc: '【事故原因】生冷海鲜冰沙引发群体性抗议。蹲厕省时，马桶则能提供更从容的救援。', bg: './img/background5.png' }
];

const DIFFICULTIES = {
  casual: { name: '轻松', patience: 1.25, decay: 1, arrivalTime: 1.2, waveFactor: 6, score: .75 },
  normal: { name: '标准', patience: 1, decay: 1, arrivalTime: 1, waveFactor: 5, score: 1 },
  crisis: { name: '危机', patience: .8, decay: 1, arrivalTime: .8, waveFactor: 4, score: 1.5 }
};

const TRAITS = [
  { id: 'brave_face', name: '形象包袱', icon: '💄', desc: '忍耐高于40%时消耗降低15%，低于40%后消耗加快20%' },
  { id: 'discipline', name: '队首纪律', icon: '📏', desc: '排在队首时能镇定下来，忍耐消耗降低25%' },
  { id: 'newcomer', name: '水土不服', icon: '🧳', desc: '到场前1分钟忍耐消耗加快40%，之后降低10%' },
  { id: 'professional', name: '职业微笑', icon: '🎀', desc: '安抚对她的恢复效果提高40%' },
  { id: 'coser', name: '繁复衣装', icon: '👗', desc: '安排马桶额外+70，安排蹲厕额外−35' },
  { id: 'homebody', name: '独处安心', icon: '🏠', desc: '队伍只剩3人以内时，忍耐消耗降低35%' },
  { id: 'rebel', name: '越催越快', icon: '🔥', desc: '她在隔间时，“催促”的推进量提高70%' },
  { id: 'reader', name: '沉浸阅读', icon: '📖', desc: '每等待2分钟会专注阅读，暂停自身消耗30秒' },
  { id: 'runner', name: '蹲姿冲刺', icon: '🏃', desc: '安排蹲厕额外得分+65' },
  { id: 'nervous', name: '人群紧张', icon: '😰', desc: '队伍超过5人时消耗加快30%；忍耐度≥65%入厕额外+60' },
  { id: 'lady', name: '洁癖千金', icon: '✨', desc: '使用马桶时，额外得分等于当前忍耐度×100' },
  { id: 'miko', name: '和服层叠', icon: '⛩️', desc: '安排马桶额外+80，安排蹲厕额外−45' },
  { id: 'potion', name: '魔药波动', icon: '🧪', desc: '消耗每30秒在降低35%与加快45%间切换；忍耐度≥65%入厕额外+60' },
  { id: 'dignity', name: '教师定力', icon: '👓', desc: '忍耐低于35%后冷静应对，忍耐消耗降低35%' },
  { id: 'elf', name: '治愈共鸣', icon: '🌿', desc: '安抚她时，队伍中的其他人也会恢复1分钟' },
  { id: 'programmer', name: '紧急备份', icon: '💻', desc: '首次跌至20%时自动恢复90秒忍耐' },
  { id: 'apprentice', name: '笨拙加速', icon: '🍰', desc: '她在隔间时，催促额外推进50%' },
  { id: 'captain', name: '队长鼓舞', icon: '⚾', desc: '只要她仍在队伍，其他人的消耗降低10%' },
  { id: 'princess', name: '公主礼遇', icon: '👑', desc: '使用马桶时，额外得分等于当前忍耐度×100' },
  { id: 'biker', name: '蹲姿老练', icon: '🏍️', desc: '安排蹲厕额外得分+80' }
];

const NAMES = ['星奈', '紬', '柚葉', '琴音', '涼風', '奈緒', '真白', '結月', '千夏', '莉子', '詩織', '瑞希', '日鞠', '凛音', '沙耶', '千寻', '美波', '芽衣', '亚里沙', '初雪'];
const PATIENCE_MINUTES = [8.5, 9, 7, 10, 7.5, 9, 15, 11, 10.5, 6, 11.5, 9, 6.5, 13.5, 9, 10, 7, 13, 13, 15];
const TOILET_MINUTES = [4.2, 3.8, 3.5, 4, 5, 4.5, 3.6, 4.4, 3, 4.2, 4.6, 5, 4, 4.3, 4, 4.2, 3.8, 3.67, 4.8, 3.75];
const IDENTITIES = ['恋爱脑的辣妹', '认真的风纪委员', '活泼的转学生', '咖啡厅头牌女仆', '知名 Coser', '慵懒的家里蹲', '暴躁的不良少女', '神秘的文学少女', '元气田径部员', '胆小的图书委员', '怕冷的千金大小姐', '传统的神社巫女', '迷糊的魔法使', '冰山御姐教师', '迷路的异界精灵', '天才少女程序员', '笨手笨脚的实习女仆', '热血的棒球队长', '出逃的异国公主', '暴走族大姐头'];
const BIOS = [
  '昨天约会吃了变态辣火锅，现在正为了不破坏形象而死死坚持。', '绝不允许自己在学校发生不雅意外，哪怕双腿发抖也要守住威严。',
  '刚到新学校便因水土不服遭遇危机，急得在原地不停跺脚。', '绝不能让主人看见狼狈的样子，正在用职业素养苦苦支撑。',
  '吃了粉丝送的不明零食，偏偏身上的服装解开还需要很久。', '难得出门却喝了变质冰牛奶，脆弱肠胃正如洗衣机般翻滚。',
  '嘴上还在追查是谁动了炒面面包，生理防线却已经摇摇欲坠。', '平时总是云淡风轻，现在只能闭着眼睛对抗自然的呼唤。',
  '新陈代谢和跑步一样快，正试图用深蹲转移注意力。', '紧张时就会肚子痛，看到长队后已经急得眼泪汪汪。',
  '冷饮与厚衣服制造了冰火两重天，急需一个温暖隔间。', '误食过期供品，层层和服意味着她需要更久的准备时间。',
  '试喝神秘魔药后肠胃暴走，急需解除这场可怕诅咒。', '高傲教师绝不能在学生面前出丑，表情却已经快绷不住了。',
  '不适应人类食物，更无法理解人类公厕为何还要排队。', '连续熬夜编程后吃了过期泡面，正在承受巨大的系统故障。',
  '偷吃过期奶油蛋糕引发惨案，胆小的她已经快哭出来了。', '赛前喝下太多冰镇饮料，毅力惊人但防线并不可靠。',
  '第一次吃路边摊便遭遇滑铁卢，从没受过这样的排队委屈。', '高速狂飙时突然剧痛，好不容易找到公厕却发现已经爆满。'
];

const CHARACTER_DIALOGUES = [
  { waiting: ['妆可不能花……我还能优雅地等。', '约会迟到总比形象崩掉好吧？'], urgent: ['等下，我的笑容真的快维持不住了！', '拜托快一点，我绝对不能在这里出丑！'], entry: ['还好还好，妆都没乱。', '呼……差一点就要形象破产了。', '不许看！今天的事谁都不准说！'], inside: ['外面别催啦，我已经很努力了！', '这顿变态辣的后劲也太夸张了……'], nearDone: '马上就好，再给我一点点时间！', success: '总算保住了完美形象，算你有眼光。', fail: '我的形象彻底完了……你欠我一次约会补偿。' },
  { waiting: ['排队也要遵守秩序，请不要慌张。', '我会做好表率，坚持到轮到自己。'], urgent: ['队列秩序不能乱……可我真的快不行了。', '请、请允许我暂时放下风纪委员的威严！'], entry: ['按顺序入厕，处理得很规范。', '判断及时，感谢你的调度。', '刚才那是紧急避险，不算违反校规！'], inside: ['请勿敲门，里面正在处理紧急事务。', '我也闹肚子，请大家保持安静！'], nearDone: '即将处理完毕，请下一位做好准备。', success: '本次调度合格，我会在报告里如实表扬你。', fail: '现场管理严重失职，我会提交一份完整检讨要求。' },
  { waiting: ['新学校的厕所……应该就在这里没错吧？', '第一次和大家排队，还有点紧张呢。'], urgent: ['水土不服原来这么可怕，救命！', '脚已经停不下来啦，真的要到极限了！'], entry: ['赶上啦！新学校的厕所也很亲切呢。', '谢谢带路，再晚一点就危险了！', '呜哇，差点成为转学第一天的大新闻！'], inside: ['别担心，我会尽量快一点的！', '我的肚子还没适应这里的食物啦……'], nearDone: '快好啦，下一位再等我一下！', success: '虽然开局很狼狈，但我开始喜欢这所学校了！', fail: '转学第一天就这样……请让我换个没人认识的班级吧。' },
  { waiting: ['女仆的职业素养，就是任何时候都保持微笑。', '主人还在等我，我必须优雅地解决问题。'], urgent: ['笑容……快要维持不住了，请尽快安排！', '这是最高等级的女仆紧急请求！'], entry: ['服务状态良好，感谢您的安排。', '呼……差一点就让主人看见失态了。', '这是秘密任务，请务必替我保密！'], inside: ['请不要催促，女仆也正在全力处理。', '那块奶油蛋糕果然有问题……'], nearDone: '即将恢复营业，请稍候片刻。', success: '完美的调度，值得一份女仆特制甜点。', fail: '职业微笑已经碎掉了……今天只能提前打烊。' },
  { waiting: ['这套衣服层数很多，得提前留出准备时间。', '要是造型完整地撑过去，也算敬业吧。'], urgent: ['糟糕，束腰在和我的肚子一起抗议！', '快给我能整理衣服的隔间，真的来不及了！'], entry: ['服装状态良好，可以从容拆卸。', '时机正好，差一点就要毁掉整套造型。', '极限入场！这段绝对不能被直播出去！'], inside: ['外面别拍门，这套衣服真的很难脱！', '粉丝送的零食威力也太强了……'], nearDone: '快穿回去了，再等最后几个扣子！', success: '服装和尊严都保住了，下次返图给你精修。', fail: '这套高定算是报废了……禁止上传现场照片！' },
  { waiting: ['如果能直接传送回家就好了……', '排队好累，我只想缩进被窝。'], urgent: ['出门果然会遭遇不幸……肚子要坏掉了。', '我不想在人群里迎来人生终点啊！'], entry: ['终于有一个可以独处的小空间了。', '谢谢……我的社交电量和忍耐都见底了。', '关门关门！谁都不要记得我来过！'], inside: ['别敲门，我连回应的力气都没有……', '那盒冰牛奶果然不该喝。'], nearDone: '再等一会儿……马上可以回家了。', success: '活着回到被窝的概率提高了，谢谢。', fail: '我就知道不该出门……让我原地退网吧。' },
  { waiting: ['啧，我才没急，只是在热身。', '谁再盯着我看，我就让她去队尾。'], urgent: ['可恶……肚子居然敢背叛我！', '快安排！再拖我可真的要发火了！'], entry: ['哼，算你反应够快。', '差一点而已，我当然控制得住。', '把门关上！谁敢笑我就完了！'], inside: ['别催！你以为我不想快点吗？', '我也在闹肚子，外面安静点！'], nearDone: '快好了！别再敲门了！', success: '这次算我欠你一个人情，别到处说。', fail: '敢把今天的事传出去，你就死定了！' },
  { waiting: ['把注意力放在书页上，时间就会快一些。', '故事正到关键处，我还可以继续读。'], urgent: ['文字已经看不清了……现实比小说残酷。', '这一章的结局，不该是在队伍里崩溃。'], entry: ['这一页刚好读完，时机恰当。', '你像编辑一样及时拯救了剧情。', '这是悬崖边的转折……差一点就是悲剧。'], inside: ['请别催，让我安静地翻完现实这一页。', '看来那杯隔夜咖啡才是真正的反派。'], nearDone: '终章将至，很快就能让出隔间。', success: '结局令人满意，我愿意给你的调度五星。', fail: '这是一本彻底的悲剧……我拒绝写读后感。' },
  { waiting: ['保持节奏，像赛前呼吸一样就行。', '这点压力还不够让我退出比赛。'], urgent: ['不行，防线已经进入最后一百米！', '谁能让我冲刺进空隔间，我保证破纪录！'], entry: ['节奏不错，顺利进入补给站！', '漂亮的冲刺安排，正好赶上！', '压线抵达！刚才比决赛还刺激！'], inside: ['别催，身体恢复也需要配速！', '冰饮料的反扑比最后一圈还凶。'], nearDone: '最后冲刺，马上交棒给下一位！', success: '调度速度很棒，下次来田径部当领队吧！', fail: '这场比赛输得太难看了……我要加练忍耐力。' },
  { waiting: ['人好多……我尽量不挡到别人。', '只要安静排队，应该不会有人注意我吧。'], urgent: ['对不起，可、可以让我快一点进去吗？', '眼泪要出来了……我真的忍不住了。'], entry: ['谢谢……这里终于安静一点了。', '你注意到我了，真的太好了。', '呜……只差一点点，刚才吓死我了。'], inside: ['请不要催，我会尽快出来的……', '一紧张肚子就更痛，怎么办……'], nearDone: '马、马上就好了，请再等等。', success: '谢谢你没有忽略我……我会把这份帮助记下来。', fail: '果然还是给大家添麻烦了……我想躲进书架后面。' },
  { waiting: ['这只是一次小小的身体抗议，不必失态。', '无论如何，礼仪都不能丢。'], urgent: ['请立刻为我安排干净的隔间！', '我承认情况很紧急，但不许围观！'], entry: ['环境尚可，安排也算周到。', '判断及时，我会记住你的服务。', '刚才的狼狈不在任何人的记忆里，明白吗？'], inside: ['请勿催促，整理仪容需要时间。', '冷饮和厚外套真是最糟糕的组合……'], nearDone: '再稍候片刻，我很快恢复体面。', success: '你的服务配得上优秀评价与额外小费。', fail: '这是不可原谅的接待事故，我要正式投诉。' },
  { waiting: ['静心、调息，神明会护佑我的。', '层层衣带虽麻烦，也不能乱了仪式。'], urgent: ['神明大人，这次请务必显灵！', '已经无法静心了，请快安排马桶！'], entry: ['一切尚在神明庇佑之中。', '感谢引路，这份恩情我会记下。', '仅差一线……今日的厄运实在凶险。'], inside: ['莫要催促，衣带还未整理妥当。', '过期供品的怨念竟如此强烈……'], nearDone: '净化将成，很快便可开门。', success: '此次化险为夷，我会为你写一枚护符。', fail: '大凶之兆应验了……必须举行彻底的祓除仪式。' },
  { waiting: ['理论上这瓶魔药的副作用应该快结束了。', '先记录波动周期……嗯，还可以忍。'], urgent: ['计算失败！副作用正在指数级增长！', '谁来解除诅咒，我要控制不住魔力了！'], entry: ['魔力波形稳定，暂时安全。', '好险，刚好赶在下一次波动前。', '封印极限维持成功！快关门！'], inside: ['不要敲门，魔药反应还没结束！', '锅里一定多放了三倍月光草……'], nearDone: '反应正在收束，马上解除警报！', success: '实验数据很宝贵，你也很可靠！', fail: '这不是失败，是一次代价非常惨烈的实验事故。' },
  { waiting: ['保持冷静，我不会在学生面前失去从容。', '课堂管理比这支队伍难不了多少。'], urgent: ['……立刻安排，这是教师的紧急指示。', '别让学生看见，我的威严只剩最后一点了！'], entry: ['尚算及时，你的判断值得肯定。', '很好，课堂秩序暂时保住了。', '关门。刚才什么都没有发生。'], inside: ['不要催，老师也需要完整处理问题。', '看来教职工餐厅今天必须停业整顿。'], nearDone: '即将结束，下一位提前准备。', success: '危机处理优秀，我会给你加上平时分。', fail: '这堂危机管理课，你显然没有及格。' },
  { waiting: ['人类的排队仪式真是漫长。', '森林里的风能让疼痛平静一些……这里没有风。'], urgent: ['自然之力也压不住这场灾难了！', '请快一点，我听见肚子在发出战争号角！'], entry: ['这个小房间有令人安心的结界。', '感谢你，人类的调度也有温柔之处。', '世界树保佑……刚才真的只差一瞬！'], inside: ['请别催，治愈术对肚子痛没有效果。', '人类食物的威力比魔兽还可怕。'], nearDone: '自然重新平静，很快便归还结界。', success: '你守护了精灵的尊严，愿森林祝福你。', fail: '我要回森林了，人类世界实在太危险。' },
  { waiting: ['忍耐值尚在安全区，继续监控。', '排队算法低效，但当前还能运行。'], urgent: ['警告：生理系统即将发生严重故障！', '需要立刻分配资源，不能再排队了！'], entry: ['资源分配完成，系统稳定。', '调度延迟可接受，数据已保存。', '在崩溃前完成热迁移……好险。'], inside: ['请勿催促，后台任务仍在执行。', '过期泡面触发了无法捕获的异常。'], nearDone: '清理进程即将完成，准备释放资源。', success: '你的调度算法通过了压力测试，建议上线。', fail: '系统彻底崩溃……而且这次没有可用备份。' },
  { waiting: ['我会乖乖排队，不给前辈添麻烦。', '只要像端盘子一样稳住就好了吧？'], urgent: ['呜呜，真的端不稳了，谁来帮帮我！', '再等下去就要犯比摔蛋糕更大的错误了！'], entry: ['太好了，这次没有绊倒！', '谢谢搭救，我会更努力工作的！', '差一点就酿成大事故……呜哇！'], inside: ['请不要催，我越急越容易出错！', '那块过期奶油果然不能偷吃……'], nearDone: '马上收拾好，请再给我一点时间！', success: '谢谢你！我请你吃新鲜的蛋糕，绝不过期！', fail: '我又搞砸了……前辈一定会让我重新实习。' },
  { waiting: ['全员稳住！队长会坚持到最后！', '把这当成延长赛，不能先泄气。'], urgent: ['队长也有极限，赶快给我一个空位！', '第九局下半，防线真的要被击穿了！'], entry: ['安全上垒，局势仍在掌控中！', '漂亮的战术安排，救了整支队伍！', '压哨本垒打！差点就输了！'], inside: ['外面稳住，我也在拼尽全力！', '冰镇饮料这球也太刁钻了……'], nearDone: '两出局了，马上结束这一局！', success: '指挥得漂亮！你就是今天的最佳教练！', fail: '这场败仗算我的……但你的换人也太迟了！' },
  { waiting: ['本公主可以等待，但队伍为何如此漫长？', '若在王宫，此刻早已有侍从安排妥当。'], urgent: ['这是王室最高等级的紧急状态！', '快让开，本公主的尊严已经危在旦夕！'], entry: ['安排尚可，准许你继续侍奉。', '做得很好，本公主会赐予赏赐。', '差一点酿成外交事故，立刻关门！'], inside: ['外面不许催促，这是王室事务！', '那份路边小吃竟敢冒犯本公主……'], nearDone: '准备迎接本公主凯旋，很快就好。', success: '你守住了王室体面，今日功绩值得嘉奖。', fail: '这是严重的外交事故！本公主要立刻回国！' },
  { waiting: ['这点疼算什么，比机车震动差远了。', '都站稳了，别因为排队自乱阵脚。'], urgent: ['可恶，这肚子比失控的引擎还凶！', '给我空出隔间，再慢就要翻车了！'], entry: ['稳稳刹住，技术不错。', '路线安排够利落，我认你这个领航。', '极限过弯！刚才差点车毁人亡！'], inside: ['别催，引擎过热也得等它冷下来！', '路边那杯冰饮果然有问题……'], nearDone: '故障快排完了，马上重新上路！', success: '够可靠。下次跑夜路，我让你坐头车。', fail: '彻底翻车了……这笔账我记在那家摊子头上。' }
];

const COMFORT_DIALOGUES = [
  '呼……先把注意力放回妆容，我还能优雅地坚持。',
  '情绪已经稳定，队列秩序也能继续维持。',
  '谢谢鼓励！深呼吸以后好像没那么可怕了。',
  '职业微笑重新上线，女仆还能继续服务。',
  '好，先放松束腰……这套衣服还能保住。',
  '被温柔照顾的感觉……好像没那么想逃回家了。',
  '哼，我本来就撑得住……不过谢了。',
  '呼吸平稳了，终于又能看清书上的字。',
  '调整呼吸、稳住核心……还能再跑一段！',
  '谢、谢谢，大家没有在盯着我吧？我好多了。',
  '这份安抚尚算得体，我可以继续保持礼仪。',
  '心神已定，衣带与腹中躁动都平静了一些。',
  '魔力波动下降了！这次安抚居然有效。',
  '很好，我已经重新找回教师应有的从容。',
  '温柔的气息传过来了……自然正在治愈我。',
  '压力指标下降，系统恢复到可继续运行状态。',
  '呜……谢谢，我会稳稳坚持，不再慌张！',
  '全队深呼吸！队长的防线重新稳住了！',
  '不错，这才是符合王室规格的关怀。',
  '引擎温度降下来了，这点故障还能压住。'
];

const RUSH_DIALOGUES = [
  '别催啦！越急越难保持优雅，马上就好！',
  '收到催促，请外面维持秩序，我会加快处理。',
  '我真的已经很努力啦，新学校的厕所压力也太大了！',
  '主人请稍候，女仆正在以最高效率处理！',
  '别拍门！扣子和束腰不是说快就能快的！',
  '催也没用啦……我已经把剩余社交电量全用上了。',
  '吵什么吵！我比外面的人更想赶紧结束！',
  '请安静，故事和现实都快到结尾了。',
  '收到！进入最后冲刺，马上交棒！',
  '别、别催我，我一紧张肚子会更痛的！',
  '敲门很失礼；我会尽快恢复体面。',
  '莫催，层层衣带正在尽快整理。',
  '反应正在加速，但催太猛可能会炸锅呀！',
  '无需反复提醒，我正在处理紧急状况。',
  '人类的催促声比魔兽还可怕……马上好了！',
  '催促信号已接收，正在提高后台任务优先级。',
  '我一急就会出错……但、但我会努力快一点！',
  '听到了！最后一局，全力结束战斗！',
  '竟敢催促王室事务……罢了，本公主会加快。',
  '别轰油门了！故障排完我自然会出去！'
];

const ENTRY_TIERS = [
  { key: 'calm', min: .65, label: '从容入厕', icon: '◎' },
  { key: 'timely', min: .35, label: '及时救援', icon: '✓' },
  { key: 'urgent', min: .15, label: '极限抢救', icon: '!' },
  { key: 'critical', min: 0, label: '千钧一发', icon: '‼' }
];

const RESULT_URGENCY_COMMENTS = {
  '从容入厕': '你很早就替我留出了位置，整个过程几乎没有慌乱。',
  '及时救援': '安排时机刚刚好，再拖一会儿我就很难保持镇定了。',
  '极限抢救': '刚才已经逼近极限，好在你最后的判断足够准确。',
  '千钧一发': '真的只差最后一步；再晚一点，这句评价就完全不同了。'
};

const PORTRAIT_STATES = [
  { key: 'standard', label: '标准', face: character => character.face },
  { key: 'normal', label: '普通', face: character => getStateFace(character, 'anxious') },
  { key: 'anxious', label: '着急', face: character => getStateFace(character, 'critical') },
  { key: 'extreme', label: '极限', face: character => getStateFace(character, 'extreme') },
  { key: 'release', label: '释放', face: character => getStateFace(character, 'relaxed') }
];
const DIALOGUE_EMOJIS = {
  waiting: ['💦', '🥺', '🫣', '😣'],
  urgent: ['🚨', '😭', '💥', '🆘'],
  entry: ['🚪', '✨', '🙏', '💨'],
  inside: ['🚽', '💦', '😖', '🫠'],
  nearDone: ['⏳', '🙏', '✨', '😮‍💨'],
  comfort: ['💗', '🌸', '✨']
};

const DEFAULT_SAVE = {
  settings: { audio: true, volume: .5, experimental: false, customVictims: false, difficulty: 'normal', preferOriginalWeb: false, defaultBigIcons: false, defaultUrgencySort: false },
  customScenes: [], characterOverrides: {}, selectedVictims: [], records: {}
};

let saveData = loadSave();
let settings = saveData.settings;
let scenes = [...BUILTIN_SCENES, ...saveData.customScenes];
let characters = buildCharacters();
let currentScene = null;
let selectedBg = ORIGINAL_BG;
let selectedVictims = [...saveData.selectedVictims];
let game = null;
let toastTimer = null;
let galleryBigMode = false;
let galleryState = 'standard';
let originalAssetsLoading = false;
let webThumbnailsReady = IS_LOCAL_RUNTIME;
let lastCoarseAssignmentAt = 0;

function byId(id) { return document.getElementById(id); }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function randomFrom(items) { return items[Math.floor(Math.random() * items.length)]; }
function withEmoji(text, mood = 'waiting') { return `${randomFrom(DIALOGUE_EMOJIS[mood] || DIALOGUE_EMOJIS.waiting)} ${text}`; }
function isManagedAsset(logicalPath) { return /^\.\/img\/[^/]+\.png$/i.test(logicalPath || ''); }
function getAssetPath(logicalPath, track) {
  if (!isManagedAsset(logicalPath)) return logicalPath;
  const fileName = logicalPath.split('/').at(-1);
  return track === 'original' ? `./img/original/${fileName}` : `./img/thumb/${fileName.replace(/\.png$/i, '.webp')}`;
}
function prefersOriginalAssets() { return IS_LOCAL_RUNTIME || Boolean(settings?.preferOriginalWeb); }
function getAssetCandidates(logicalPath) {
  if (!isManagedAsset(logicalPath)) return [logicalPath];
  const thumbnail = getAssetPath(logicalPath, 'thumb');
  return prefersOriginalAssets() ? [getAssetPath(logicalPath, 'original'), thumbnail] : [thumbnail];
}
function setManagedImage(image, logicalPath) {
  if (!image) return;
  const [primary, fallback] = getAssetCandidates(logicalPath);
  image.dataset.logical = logicalPath;
  if (fallback) image.dataset.fallback = fallback;
  else delete image.dataset.fallback;
  image.src = primary;
}
function imageAttributes(logicalPath, alt) {
  const [primary, fallback] = getAssetCandidates(logicalPath);
  return `src="${primary}" data-logical="${logicalPath}"${fallback ? ` data-fallback="${fallback}"` : ''} alt="${alt}"`;
}
function loadFirstAvailableAsset(logicalPath) {
  const candidates = getAssetCandidates(logicalPath);
  return new Promise(resolve => {
    const tryIndex = index => {
      if (index >= candidates.length) { resolve(candidates.at(-1)); return; }
      const image = new Image();
      image.onload = () => resolve(candidates[index]);
      image.onerror = () => tryIndex(index + 1);
      image.src = candidates[index];
    };
    tryIndex(0);
  });
}
async function setElementBackground(element, logicalPath, overlay = '') {
  if (!element) return;
  const requestId = String(Date.now() + Math.random());
  element.dataset.logicalBg = logicalPath;
  element.dataset.bgRequest = requestId;
  const resolved = await loadFirstAvailableAsset(logicalPath);
  if (element.dataset.bgRequest !== requestId) return;
  element.style.backgroundImage = `${overlay ? `${overlay}, ` : ''}url('${resolved}')`;
}
function getAllImageAssets() {
  const portraits = Array.from({ length: 20 }, (_, id) => PORTRAIT_ASSET_STATES.map(state => `./img/girl${id}${state}.png`)).flat();
  const backgrounds = Array.from({ length: 6 }, (_, id) => `./img/background${id}.png`);
  return [...backgrounds, ...portraits];
}
function getAllAudioAssets() { return Object.values(AUDIO_FILES).flat(); }
async function preloadAudioAsset(url) {
  try {
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) return false;
    await response.arrayBuffer();
    return true;
  } catch {
    return false;
  }
}
async function initializeWebThumbnails() {
  const button = byId('btn-open-scenes');
  const status = byId('asset-init-status');
  if (IS_LOCAL_RUNTIME) {
    webThumbnailsReady = true;
    button.disabled = false;
    status.hidden = true;
    return;
  }
  webThumbnailsReady = false;
  button.disabled = true;
  status.hidden = false;
  const assets = getAllImageAssets();
  let cursor = 0;
  let completed = 0;
  let missing = 0;
  const updateProgress = () => {
    const percent = Math.round(completed / assets.length * 100);
    button.textContent = `初始化资源 ${percent}%`;
    status.textContent = `正在载入约 6MB 的轻量图片……${completed}/${assets.length}`;
  };
  updateProgress();
  const worker = async () => {
    while (cursor < assets.length) {
      const logicalPath = assets[cursor++];
      if (!await loadExactImage(getAssetPath(logicalPath, 'thumb'))) missing += 1;
      completed += 1;
      updateProgress();
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  const imageMissing = missing;
  const audioAssets = getAllAudioAssets();
  cursor = 0;
  completed = 0;
  missing = 0;
  const updateAudioProgress = () => {
    const percent = Math.round(completed / audioAssets.length * 100);
    button.textContent = `预载音频 ${percent}%`;
    status.textContent = `正在预载约 1.5MB 的游戏音频……${completed}/${audioAssets.length}`;
  };
  updateAudioProgress();
  const audioWorker = async () => {
    while (cursor < audioAssets.length) {
      const url = audioAssets[cursor++];
      if (!await preloadAudioAsset(url)) missing += 1;
      completed += 1;
      updateAudioProgress();
    }
  };
  await Promise.all(Array.from({ length: 6 }, audioWorker));
  const audioMissing = missing;
  webThumbnailsReady = true;
  button.disabled = false;
  button.textContent = '开始游戏';
  status.textContent = imageMissing || audioMissing
    ? `资源初始化完成 · 图片缺失 ${imageMissing} · 音频缺失 ${audioMissing}`
    : '轻量图片与游戏音频已就绪 · 约 7.5MB';
}
function openScenes() {
  if (!webThumbnailsReady) { showToast('游戏资源仍在初始化，请稍候'); return; }
  renderSceneButtons();
  showScreen('screen-scene');
}
function refreshManagedAssets() {
  document.querySelectorAll('img[data-logical]').forEach(image => setManagedImage(image, image.dataset.logical));
  document.querySelectorAll('[data-logical-bg]').forEach(element => setElementBackground(element, element.dataset.logicalBg, element.classList.contains('screen') ? 'linear-gradient(rgba(255,255,255,.28), rgba(255,238,245,.42))' : ''));
}
function loadExactImage(url) {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = url;
  });
}
async function toggleOriginalAssets() {
  if (IS_LOCAL_RUNTIME || originalAssetsLoading) return;
  if (settings.preferOriginalWeb) {
    settings.preferOriginalWeb = false;
    persist();
    syncSettingsUI();
    refreshManagedAssets();
    showToast('已切回轻量缩略图');
    return;
  }
  originalAssetsLoading = true;
  const button = byId('btn-original-assets');
  const status = byId('original-assets-status');
  button.disabled = true;
  const assets = getAllImageAssets();
  let cursor = 0;
  let loaded = 0;
  let missing = 0;
  const worker = async () => {
    while (cursor < assets.length) {
      const logicalPath = assets[cursor++];
      if (await loadExactImage(getAssetPath(logicalPath, 'original'))) loaded += 1;
      else missing += 1;
      status.textContent = `正在下载高清原图……${loaded + missing}/${assets.length}`;
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  settings.preferOriginalWeb = true;
  originalAssetsLoading = false;
  persist();
  syncSettingsUI();
  refreshManagedAssets();
  showToast(missing ? `已启用原图，${missing} 张缺失资源使用缩略图` : '高清原图已加载并启用');
}
function bindImmediateButton(button, action) {
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0 || button.disabled) return;
    const coarsePointer = event.pointerType === 'touch' || window.matchMedia?.('(pointer: coarse)').matches;
    const now = performance.now();
    if (coarsePointer && now - lastCoarseAssignmentAt < 400) return;
    if (coarsePointer) lastCoarseAssignmentAt = now;
    event.preventDefault();
    action();
  });
  button.addEventListener('click', event => {
    if (event.detail !== 0 || button.disabled) return;
    action();
  });
}
function getDialogue(character) { return CHARACTER_DIALOGUES[character.id] || CHARACTER_DIALOGUES[0]; }
function getStateFace(character, state) { return `./img/girl${character.id}-${state}.png`; }
function getQueueFace(character, ratio) {
  if (ratio < .35) return getStateFace(character, 'extreme');
  if (ratio < .62) return getStateFace(character, 'critical');
  return getStateFace(character, 'anxious');
}
function preloadCharacterStates(character) {
  ['anxious', 'critical', 'extreme', 'relaxed'].forEach(state => {
    const image = new Image();
    setManagedImage(image, getStateFace(character, state));
  });
}
function getEntryTier(ratio) { return ENTRY_TIERS.find(tier => ratio >= tier.min) || ENTRY_TIERS.at(-1); }
function getEntryQuote(character, tier) {
  const index = tier.key === 'calm' ? 0 : tier.key === 'timely' ? 1 : 2;
  return withEmoji(getDialogue(character).entry[index], 'entry');
}
function getResultComment(character, success, entryTier) {
  if (!success) return getDialogue(character).fail;
  return `${getDialogue(character).success} ${RESULT_URGENCY_COMMENTS[entryTier] || ''}`.trim();
}
function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function formatTime(seconds) {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}
function normalizeCustomScene(scene) {
  return {
    ...scene,
    toilets: normalizeToilets(scene),
    desc: String(scene?.desc || '').replace(/^【自定义事故】/, '【事故原因】')
  };
}
function loadSave() {
  try {
    const currentRaw = localStorage.getItem(SAVE_KEY);
    const legacyRaw = localStorage.getItem(LEGACY_SAVE_KEY);
    const isLegacy = !currentRaw && Boolean(legacyRaw);
    const raw = JSON.parse(currentRaw || legacyRaw || 'null');
    const overrides = raw?.characterOverrides || {};
    if (isLegacy) {
      Object.values(overrides).forEach(item => {
        if (item.patience) item.patience *= 4;
        if (item.toilet) item.toilet *= 4;
      });
    }
    return {
      settings: { ...DEFAULT_SAVE.settings, ...(raw?.settings || {}) },
      customScenes: Array.isArray(raw?.customScenes) ? raw.customScenes.map(normalizeCustomScene) : [],
      characterOverrides: overrides,
      selectedVictims: Array.isArray(raw?.selectedVictims) ? raw.selectedVictims : [],
      records: raw?.records || {}
    };
  } catch (error) {
    console.warn('存档读取失败，已使用默认值。', error);
    return structuredClone(DEFAULT_SAVE);
  }
}
function persist() {
  saveData.settings = settings;
  saveData.customScenes = scenes.filter(scene => scene.isCustom);
  saveData.selectedVictims = selectedVictims;
  localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
}

function buildCharacters() {
  return NAMES.map((name, id) => {
    const override = saveData.characterOverrides[id] || {};
    const defaultPatience = Math.round(PATIENCE_MINUTES[id] * 60);
    const defaultToilet = Math.round(TOILET_MINUTES[id] * 60);
    return {
      id, name, identity: IDENTITIES[id], bio: BIOS[id], face: `./img/girl${id}.png`, color: `hsl(${id * 18}, 70%, 72%)`,
      patienceMax: clamp(Number(override.patience) || defaultPatience, 300, 1200),
      toiletTimeMax: clamp(Number(override.toilet) || defaultToilet, 120, 600),
      defaultPatience, defaultToilet, trait: TRAITS[id]
    };
  });
}

function playSound(type) {
  if (!settings.audio || settings.volume <= 0 || !AUDIO_FILES[type]) return;
  const now = performance.now();
  const cooldown = AUDIO_COOLDOWNS[type] || 1000;
  if (now - (audioState.lastPlayed[type] || 0) < cooldown || audioState.active.size >= 5) return;
  audioState.lastPlayed[type] = now;
  const audio = new Audio(randomFrom(AUDIO_FILES[type]));
  const multiplier = type === 'belly' ? .28 : type === 'fart' ? .5 : type === 'diarrhea' ? .58 : .8;
  audio.volume = clamp(settings.volume * multiplier, 0, 1);
  audio.playbackRate = game ? 1 + (game.speed - 1) * .1 : 1;
  audioState.active.add(audio);
  const cleanup = () => audioState.active.delete(audio);
  audio.addEventListener('ended', cleanup, { once: true });
  audio.addEventListener('error', cleanup, { once: true });
  audio.play().catch(cleanup);
}
function stopAllSounds() {
  audioState.active.forEach(audio => { audio.pause(); audio.currentTime = 0; });
  audioState.active.clear();
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(screen => screen.classList.toggle('active', screen.id === id));
  window.scrollTo(0, 0);
}
function setScreenBackground(id, bg) {
  setElementBackground(byId(id), bg || ORIGINAL_BG, 'linear-gradient(rgba(255,255,255,.28), rgba(255,238,245,.42))');
}
function goHome() {
  if (game?.timer) clearInterval(game.timer);
  stopAllSounds();
  game = null;
  const mascot = randomFrom(characters);
  setManagedImage(document.querySelector('.mascot img'), mascot.face);
  const availableBgs = [ORIGINAL_BG, ...scenes.map(scene => scene.bg).filter(Boolean)];
  setScreenBackground('screen-home', randomFrom(availableBgs));
  updateHomeRecord();
  showScreen('screen-home');
}
function updateHomeRecord() {
  const records = Object.values(saveData.records);
  if (!records.length) {
    byId('home-record').textContent = '尚无救援纪录 · 完成第一局后会自动保存';
    return;
  }
  const best = records.sort((a, b) => b.score - a.score)[0];
  byId('home-record').textContent = `最高纪录：${best.sceneName} · ${best.grade} 级 · ${best.score.toLocaleString()} 分`;
}

function syncSettingsUI() {
  const toggle = (id, on) => {
    byId(id).textContent = on ? '开启' : '关闭';
    byId(id).classList.toggle('off', !on);
  };
  toggle('btn-audio', settings.audio);
  toggle('btn-exp', settings.experimental);
  toggle('btn-custom-victims', settings.customVictims);
  toggle('btn-default-big-icons', settings.defaultBigIcons);
  toggle('btn-default-urgency-sort', settings.defaultUrgencySort);
  byId('web-original-setting').hidden = IS_LOCAL_RUNTIME;
  byId('web-save-reminder').hidden = IS_LOCAL_RUNTIME;
  if (!IS_LOCAL_RUNTIME) {
    toggle('btn-original-assets', settings.preferOriginalWeb);
    byId('btn-original-assets').disabled = originalAssetsLoading;
    if (!originalAssetsLoading) byId('original-assets-status').textContent = settings.preferOriginalWeb
      ? '已优先使用高清原图；个别原图缺失时自动回退缩略图。'
      : '网页版默认使用轻量缩略图；开启后下载高清原图并优先显示。';
  }
  byId('vol-slider').value = settings.volume;
  byId('vol-display').textContent = `${Math.round(settings.volume * 100)}%`;
  byId('difficulty-select').value = settings.difficulty;
  byId('scene-difficulty').value = settings.difficulty;
}
function toggleSetting(key) {
  settings[key] = !settings[key];
  syncSettingsUI();
  if (key === 'audio' && !settings.audio) stopAllSounds();
  if (currentScene && key === 'customVictims') selectScene(currentScene);
  persist();
}

function normalizeToilets(scene) {
  if (scene.toilets) {
    let squat = clamp(Math.round(Number(scene.toilets.squat) || 0), 0, 10);
    let seated = clamp(Math.round(Number(scene.toilets.seated) || 0), 0, 10);
    if (squat + seated < 1) squat = 1;
    if (squat + seated > 10) seated = Math.max(0, 10 - squat);
    return { squat, seated };
  }
  return { squat: clamp(Math.round(Number(scene.stalls) || 1), 1, 10), seated: 0 };
}

function renderSceneButtons() {
  const container = byId('scene-buttons');
  container.replaceChildren();
  scenes.forEach(scene => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `scene-button${currentScene?.id === scene.id ? ' selected' : ''}`;
    const name = document.createElement('strong');
    name.textContent = scene.name;
    const meta = document.createElement('small');
    const toilets = normalizeToilets(scene);
    meta.textContent = `蹲厕 ${toilets.squat} · 马桶 ${toilets.seated}${scene.isCustom ? ' · 自定义' : ''}`;
    button.append(name, meta);
    button.addEventListener('click', () => selectScene(scene));
    container.appendChild(button);
  });
}
function selectScene(scene) {
  currentScene = scene;
  renderSceneButtons();
  byId('scene-desc-title').textContent = scene.name;
  byId('scene-desc-text').textContent = scene.desc;
  const toilets = normalizeToilets(scene);
  byId('girl-count').value = clamp((toilets.squat + toilets.seated) * 4, 3, 20);
  byId('victim-count-container').hidden = settings.customVictims;
  byId('btn-start').textContent = settings.customVictims ? '选择出场角色' : '开始游戏';
  byId('btn-start').disabled = false;
  byId('btn-delete-scene').hidden = !scene.isCustom;
  setScreenBackground('screen-scene', scene.bg);
  renderChallengePreview();
}
function getChallenges() {
  return [
    { id: 'combo', label: '达成 3 连拯救', test: stats => stats.maxCombo >= 3 },
    { id: 'safe', label: '失禁人数不超过 1', test: stats => stats.fail <= 1 },
    { id: 'perfect', label: '全员守住尊严', test: stats => stats.fail === 0 }
  ];
}
function renderChallengePreview() {
  const container = byId('scene-challenges');
  container.replaceChildren(...getChallenges().map(challenge => {
    const span = document.createElement('span');
    span.textContent = `☆ ${challenge.label}`;
    return span;
  }));
}
function initBgSelector() {
  const container = byId('bg-selector');
  container.replaceChildren();
  const unique = [...new Map([ORIGINAL_BG, ...BUILTIN_SCENES.map(scene => scene.bg)].map(bg => [bg, bg])).values()];
  unique.forEach((bg, index) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = `bg-option${selectedBg === bg ? ' selected' : ''}`;
    setElementBackground(option, bg);
    option.setAttribute('aria-label', `背景 ${index + 1}`);
    option.addEventListener('click', () => {
      selectedBg = bg;
      container.querySelectorAll('.bg-option').forEach(item => item.classList.remove('selected'));
      option.classList.add('selected');
      setScreenBackground('screen-scene', bg);
    });
    container.appendChild(option);
  });
}
function toggleCustomForm(show = byId('custom-form').hidden) {
  byId('custom-form').hidden = !show;
  byId('scene-detail-box').hidden = show;
  if (show) {
    selectedBg = ORIGINAL_BG;
    initBgSelector();
  }
}
function applyCustomScene(event) {
  event.preventDefault();
  const title = byId('cust-title').value.trim().slice(0, 18) || '未知区域';
  const desc = byId('cust-desc').value.trim().slice(0, 100) || '没有说明的突发事件。';
  let squat = clamp(Math.round(Number(byId('cust-squat').value) || 0), 0, 10);
  let seated = clamp(Math.round(Number(byId('cust-seated').value) || 0), 0, 10);
  if (squat + seated < 1) squat = 1;
  if (squat + seated > 10) {
    const overflow = squat + seated - 10;
    seated = Math.max(0, seated - overflow);
  }
  byId('cust-squat').value = squat;
  byId('cust-seated').value = seated;
  const scene = { id: `custom_${Date.now()}`, name: title, toilets: { squat, seated }, defaultCount: clamp((squat + seated) * 4, 3, 20), desc: `【事故原因】${desc}`, isCustom: true, bg: selectedBg };
  scenes.push(scene);
  persist();
  toggleCustomForm(false);
  selectScene(scene);
  showToast('自定义场景已保存');
}
function deleteCurrentScene() {
  if (!currentScene?.isCustom || !confirm(`确定删除“${currentScene.name}”吗？`)) return;
  scenes = scenes.filter(scene => scene.id !== currentScene.id);
  currentScene = null;
  persist();
  renderSceneButtons();
  byId('scene-desc-title').textContent = '请选择场景';
  byId('scene-desc-text').textContent = '每个场景都有独特的客流与挑战。';
  byId('btn-start').disabled = true;
  byId('btn-delete-scene').hidden = true;
  setScreenBackground('screen-scene', ORIGINAL_BG);
}

function renderGallery() {
  const container = byId('gallery-container');
  container.classList.toggle('big-icon-mode', galleryBigMode);
  byId('btn-gallery-big').textContent = `大图标：${galleryBigMode ? '开' : '关'}`;
  document.querySelectorAll('[data-gallery-state]').forEach(button => button.classList.toggle('active', button.dataset.galleryState === galleryState));
  const selectedState = PORTRAIT_STATES.find(state => state.key === galleryState) || PORTRAIT_STATES[0];
  container.replaceChildren();
  characters.forEach(character => {
    const card = document.createElement('article');
    card.className = 'gallery-item';
    card.style.borderColor = character.color;
    card.innerHTML = `<div class="gallery-header"><div class="girl-avatar" style="background:${character.color}"><img ${imageAttributes(selectedState.face(character), `${character.name} · ${selectedState.label}`)} data-gallery-character="${character.id}"></div><div class="gallery-copy"><h4>${character.name}</h4><span class="trait-chip">${character.trait.icon} ${character.trait.name}</span> <small>${character.identity}</small></div></div><div class="gallery-desc">${character.bio}<br><b>${character.trait.desc}</b></div>`;
    const stats = document.createElement('div');
    stats.className = 'character-stats';
    if (settings.experimental) {
      stats.innerHTML = `<label>忍耐秒（300～1200）<input data-char="${character.id}" data-stat="patience" type="number" min="300" max="1200" value="${Math.round(character.patienceMax)}"></label><label>占用秒（120～600）<input data-char="${character.id}" data-stat="toilet" type="number" min="120" max="600" value="${Math.round(character.toiletTimeMax)}"></label>`;
    } else {
      stats.innerHTML = `<span>⏱️ 忍耐 ${formatTime(character.patienceMax)}</span><span>🚽 基础占用 ${formatTime(character.toiletTimeMax)}</span>`;
    }
    card.appendChild(stats);
    container.appendChild(card);
  });
}
function setGalleryState(stateKey) {
  const state = PORTRAIT_STATES.find(item => item.key === stateKey);
  if (!state) return;
  galleryState = stateKey;
  document.querySelectorAll('[data-gallery-state]').forEach(button => button.classList.toggle('active', button.dataset.galleryState === galleryState));
  document.querySelectorAll('[data-gallery-character]').forEach(image => {
    const character = characters.find(item => item.id === Number(image.dataset.galleryCharacter));
    if (!character) return;
    setManagedImage(image, state.face(character));
    image.alt = `${character.name} · ${state.label}`;
  });
}
function toggleGalleryBigMode() {
  galleryBigMode = !galleryBigMode;
  renderGallery();
}
function openGallery() {
  galleryBigMode = Boolean(settings.defaultBigIcons);
  renderGallery();
  showScreen('screen-gallery');
}
function updateCharacterStat(input) {
  const character = characters.find(item => item.id === Number(input.dataset.char));
  if (!character) return;
  const stat = input.dataset.stat;
  const limits = stat === 'patience' ? [300, 1200] : [120, 600];
  const value = clamp(Number(input.value) || limits[0], ...limits);
  character[stat === 'patience' ? 'patienceMax' : 'toiletTimeMax'] = value;
  saveData.characterOverrides[character.id] = {
    patience: character.patienceMax,
    toilet: character.toiletTimeMax
  };
  input.value = value;
  persist();
}
function resetCharacters() {
  if (!confirm('确定恢复全部角色的默认参数吗？')) return;
  saveData.characterOverrides = {};
  characters = buildCharacters();
  persist();
  renderGallery();
  showToast('角色参数已重置');
}

function renderVictimSelection() {
  const container = byId('select-container');
  container.replaceChildren();
  characters.forEach(character => {
    const card = document.createElement('article');
    card.className = `gallery-item${selectedVictims.includes(character.id) ? ' selected' : ''}`;
    card.dataset.characterId = character.id;
    card.tabIndex = 0;
    card.innerHTML = `<div class="gallery-header"><div class="girl-avatar" style="background:${character.color}"><img ${imageAttributes(character.face, character.name)}></div><div><h4>${character.name}</h4><span class="trait-chip">${character.trait.icon} ${character.trait.name}</span></div></div><div class="gallery-desc">${character.identity} · 忍耐 ${formatTime(character.patienceMax)} · 马桶 ${formatTime(character.toiletTimeMax)}<b class="selection-ability">能力：${character.trait.desc}</b></div>`;
    container.appendChild(card);
  });
  byId('selected-count').textContent = selectedVictims.length;
  byId('btn-confirm-victims').disabled = selectedVictims.length < 3;
}
function toggleVictim(id) {
  const index = selectedVictims.indexOf(id);
  if (index >= 0) selectedVictims.splice(index, 1);
  else if (selectedVictims.length < 20) selectedVictims.push(id);
  persist();
  renderVictimSelection();
}
function selectRandomVictims() {
  const input = byId('random-victim-count');
  const count = clamp(Math.round(Number(input.value) || 8), 3, characters.length);
  input.value = count;
  selectedVictims = shuffled(characters).slice(0, count).map(item => item.id);
  persist();
  renderVictimSelection();
}

function beginStartFlow() {
  if (!currentScene) return;
  settings.difficulty = byId('scene-difficulty').value;
  persist();
  if (settings.customVictims) {
    renderVictimSelection();
    showScreen('screen-select-victims');
  } else {
    startGame();
  }
}
function createRoster() {
  if (settings.customVictims) return shuffled(characters.filter(character => selectedVictims.includes(character.id)));
  const toilets = normalizeToilets(currentScene);
  const defaultCount = clamp((toilets.squat + toilets.seated) * 4, 3, 20);
  const count = clamp(Math.round(Number(byId('girl-count').value) || defaultCount), 3, 20);
  byId('girl-count').value = count;
  return shuffled(characters).slice(0, count);
}
function createWaveSchedule(roster, difficulty, toiletCount) {
  const waveCount = roster.length < 7 ? 2 : 3;
  const waveSizes = Array(waveCount).fill(Math.floor(roster.length / waveCount));
  const waveOrder = shuffled(Array.from({ length: waveCount }, (_, index) => index));
  for (let index = 0; index < roster.length % waveCount; index++) waveSizes[waveOrder[index]] += 1;

  if (roster.length >= waveCount * 4 && Math.random() < .65) {
    const candidates = shuffled(Array.from({ length: waveCount }, (_, index) => index));
    for (const donor of candidates) {
      if (waveSizes[donor] <= 2) continue;
      const receivers = shuffled(candidates.filter(index => index !== donor));
      const receiver = receivers.find(index => {
        const adjusted = waveSizes.map((size, wave) => size + (wave === index ? 1 : 0) - (wave === donor ? 1 : 0));
        return Math.max(...adjusted) - Math.min(...adjusted) <= 2;
      });
      if (receiver !== undefined) {
        waveSizes[donor] -= 1;
        waveSizes[receiver] += 1;
        break;
      }
    }
  }

  const schedule = [];
  const peoplePerToilet = roster.length / Math.max(1, toiletCount);
  const crowdPressure = clamp((peoplePerToilet - 4) / 8, 0, 1);
  const arrivalStep = 5.6 * difficulty.arrivalTime * (1 + crowdPressure * .6);
  const waveGapScale = 1 + crowdPressure * .5;
  let rosterIndex = 0;
  let waveStart = 0;
  waveSizes.forEach((size, wave) => {
    if (wave > 0) waveStart += (size + 6) * difficulty.waveFactor * waveGapScale * (.9 + Math.random() * .25);
    let arrivalTime = waveStart;
    for (let withinWave = 0; withinWave < size; withinWave++) {
      if (withinWave > 0) arrivalTime += arrivalStep * (.88 + Math.random() * .27);
      schedule.push({ character: roster[rosterIndex++], wave: wave + 1, time: arrivalTime });
    }
  });
  return schedule;
}
function createStalls(toilets) {
  const types = [...Array(toilets.squat).fill('squat'), ...Array(toilets.seated).fill('seated')];
  return types.map((type, index) => ({
    id: index,
    type,
    label: type === 'squat' ? '蹲厕 · 省时20%' : '马桶 · 得分+30%',
    occupant: null,
    timeLeft: 0,
    totalTime: 0,
    scoreMultiplier: type === 'seated' ? 1.3 : 1
  }));
}
function startGame() {
  if (!currentScene) return;
  const roster = createRoster();
  if (roster.length < 3) { showToast('至少选择 3 名角色'); return; }
  const difficulty = DIFFICULTIES[settings.difficulty] || DIFFICULTIES.normal;
  const toilets = normalizeToilets(currentScene);
  game = {
    elapsed: 0, speed: 4, paused: false, ended: false, queue: [], pending: createWaveSchedule(roster, difficulty, toilets.squat + toilets.seated), urgencySort: Boolean(settings.defaultUrgencySort), bigIconMode: Boolean(settings.defaultBigIcons),
    stalls: createStalls(toilets), total: roster.length, arrived: 0, currentWave: 0,
    stats: { success: 0, fail: 0, score: 0, combo: 0, maxCombo: 0, totalWait: 0, assignments: 0, criticalSaves: 0 },
    skills: { comfort: 1, rush: 1 }, difficulty, challenges: getChallenges(), outcomes: [], timer: null
  };
  byId('queue-container').replaceChildren();
  byId('stall-container').replaceChildren();
  byId('arrival-feed').textContent = '';
  setScreenBackground('screen-game', currentScene.bg);
  showScreen('screen-game');
  setSpeed(4);
  renderGame();
  game.timer = setInterval(updateGame, TICK_MS);
}

function setSpeed(speed) {
  if (!game) return;
  game.speed = clamp(Number(speed), 1, 16);
  document.querySelectorAll('[data-speed]').forEach(button => button.classList.toggle('active-speed', Number(button.dataset.speed) === game.speed));
}
function togglePause() {
  if (!game || game.ended) return;
  game.paused = !game.paused;
  byId('pause-overlay').hidden = !game.paused;
  byId('btn-pause').textContent = game.paused ? '继续' : '暂停';
}
function addArrival(entry) {
  const base = entry.character;
  preloadCharacterStates(base);
  const max = base.patienceMax * game.difficulty.patience;
  game.queue.push({ ...base, patience: max, effectiveMax: max, arrivalTime: game.elapsed, waitTime: 0, quote: withEmoji(getDialogue(base).waiting[0], 'waiting'), nextQuote: game.elapsed + 20 + Math.random() * 24, backupUsed: false });
  game.arrived += 1;
  if (entry.wave > game.currentWave) {
    game.currentWave = entry.wave;
    byId('arrival-feed').textContent = `第 ${entry.wave} 波抵达！${base.name} 等人冲进了队伍`;
    showToast(`第 ${entry.wave} 波客流抵达`);
  }
}
function updateGame() {
  if (!game || game.paused || game.ended) return;
  const delta = (TICK_MS / 1000) * game.speed;
  game.elapsed += delta;
  while (game.pending.length && game.pending[0].time <= game.elapsed) addArrival(game.pending.shift());
  updateQueue(delta);
  updateStalls(delta);
  if (!game.pending.length && !game.queue.length && game.stalls.every(stall => !stall.occupant)) {
    finishGame();
    return;
  }
  renderGame();
}
function updateQueue(delta) {
  const captainPresent = game.queue.some(girl => girl.trait.id === 'captain');
  for (let index = game.queue.length - 1; index >= 0; index--) {
    const girl = game.queue[index];
    girl.waitTime += delta;
    const ratio = girl.patience / girl.effectiveMax;
    let traitDecay = getTraitDecay(girl, index, ratio);
    if (captainPresent && girl.trait.id !== 'captain') traitDecay *= .9;
    if (!isReaderFocused(girl)) girl.patience -= delta * game.difficulty.decay * traitDecay;
    if (girl.trait.id === 'programmer' && ratio <= .2 && !girl.backupUsed) {
      girl.backupUsed = true;
      girl.patience = Math.min(girl.effectiveMax, girl.patience + 90);
      girl.quote = '💾 紧急备份恢复成功……还能再撑一下！';
      showToast(`${girl.name} 启动紧急备份，忍耐 +1:30`);
    }
    if (game.elapsed >= girl.nextQuote) {
      const dialogue = getDialogue(girl);
      girl.quote = withEmoji(randomFrom(ratio < .35 ? dialogue.urgent : dialogue.waiting), ratio < .35 ? 'urgent' : 'waiting');
      girl.nextQuote = game.elapsed + (ratio < .35 ? 14 : 28) + Math.random() * 20;
    }
    const queueSoundRate = ratio < .15 ? .024 : ratio < .35 ? .016 : ratio < .62 ? .008 : .0025;
    if (Math.random() < queueSoundRate * delta) playSound(Math.random() < .18 ? 'fart' : 'belly');
    if (girl.patience <= 0) {
      game.queue.splice(index, 1);
      addOutcome(girl, false, { reason: '等待超时' });
      game.stats.fail += 1;
      game.stats.combo = 0;
      game.stats.score = Math.max(0, game.stats.score - 90);
      playSound('incontinence');
      showToast(`${girl.name} 没能坚持住……`);
    }
  }
}
function getTraitDecay(girl, queueIndex, ratio) {
  const waited = girl.waitTime;
  switch (girl.trait.id) {
    case 'brave_face': return ratio < .4 ? 1.2 : .85;
    case 'discipline': return queueIndex === 0 ? .75 : 1;
    case 'newcomer': return waited < 60 ? 1.4 : .9;
    case 'homebody': return game.queue.length <= 3 ? .65 : 1;
    case 'nervous': return game.queue.length > 5 ? 1.3 : 1;
    case 'potion': return Math.floor(waited / 30) % 2 === 0 ? .65 : 1.45;
    case 'dignity': return ratio < .35 ? .65 : 1;
    default: return 1;
  }
}
function isReaderFocused(girl) {
  if (girl.trait.id !== 'reader') return false;
  const phase = girl.waitTime % 120;
  return girl.waitTime >= 120 && phase < 30;
}
function updateStalls(delta) {
  game.stalls.forEach(stall => {
    if (!stall.occupant) return;
    stall.timeLeft -= delta;
    const girl = stall.occupant;
    if (girl.stallQuote && game.elapsed >= girl.stallQuoteUntil) girl.stallQuote = '';
    if (game.elapsed >= girl.nextStallQuote && stall.timeLeft > 0) {
      const remainingRatio = stall.timeLeft / Math.max(1, stall.totalTime);
      girl.stallQuote = withEmoji(remainingRatio <= .28 ? getDialogue(girl).nearDone : randomFrom(getDialogue(girl).inside), remainingRatio <= .28 ? 'nearDone' : 'inside');
      girl.stallQuoteUntil = game.elapsed + 24;
      girl.nextStallQuote = game.elapsed + 38 + Math.random() * 42;
    }
    if (Math.random() < .012 * delta) playSound('diarrhea');
    if (stall.timeLeft <= 0) rescueOccupant(stall);
  });
}
function addOutcome(girl, success, details = {}) {
  if (game.outcomes.some(outcome => outcome.id === girl.id)) return;
  game.outcomes.push({
    id: girl.id, name: girl.name, identity: girl.identity, face: success ? getStateFace(girl, 'relaxed') : getStateFace(girl, 'extreme'), success,
    comment: getResultComment(girl, success, details.entryTier),
    waitTime: girl.waitTime || 0, ...details
  });
}
function maybeGrantSkill(entryTier, patienceRatio) {
  const chance = entryTier === '千钧一发' && patienceRatio <= .05 ? 1 : (SKILL_DROP_CHANCES[entryTier] ?? .5);
  if (Math.random() >= chance) return null;
  const skill = randomFrom(Object.keys(SKILL_LABELS));
  game.skills[skill] += 1;
  return skill;
}
function getExtraScore(girl, toiletType, patienceRatio) {
  switch (girl.trait.id) {
    case 'coser': return toiletType === 'seated' ? 70 : -35;
    case 'runner': return toiletType === 'squat' ? 65 : 0;
    case 'nervous': return patienceRatio >= .65 ? 60 : 0;
    case 'lady': return toiletType === 'seated' ? patienceRatio * 100 : 0;
    case 'miko': return toiletType === 'seated' ? 80 : -45;
    case 'potion': return patienceRatio >= .65 ? 60 : 0;
    case 'princess': return toiletType === 'seated' ? patienceRatio * 100 : 0;
    case 'biker': return toiletType === 'squat' ? 80 : 0;
    default: return 0;
  }
}
function rescueOccupant(stall) {
  const girl = stall.occupant;
  const patienceRatio = clamp(girl.patience / girl.effectiveMax, 0, 1);
  game.stats.success += 1;
  game.stats.combo += 1;
  game.stats.maxCombo = Math.max(game.stats.maxCombo, game.stats.combo);
  if (patienceRatio < .35) game.stats.criticalSaves += 1;
  const scoreBeforeExtra = 150 + patienceRatio * 50 + game.stats.combo * 10;
  const extraScore = getExtraScore(girl, stall.type, patienceRatio);
  const baseScore = scoreBeforeExtra + extraScore;
  const facilityMultiplier = 5 / Math.max(1, game.stalls.length);
  game.stats.score += Math.round(baseScore * stall.scoreMultiplier * game.difficulty.score * facilityMultiplier);
  addOutcome(girl, true, { entryTier: girl.entryTier, toiletType: stall.type, extraScore: Math.round(extraScore) });
  const rewardedSkill = maybeGrantSkill(girl.entryTier, girl.entryPatienceRatio);
  stall.occupant = null;
  stall.timeLeft = 0;
  stall.totalTime = 0;
  playSound('flush');
  showToast(`${girl.name} 成功解脱 · 连救 ×${game.stats.combo}${rewardedSkill ? ` · 获得「${SKILL_LABELS[rewardedSkill]}」` : ''}`);
}
function getToiletDuration(girl, toiletType) {
  return girl.toiletTimeMax * (toiletType === 'squat' ? .8 : 1);
}
function assignStall(characterId, toiletType) {
  if (!game || game.paused) return;
  const stall = game.stalls.find(item => item.type === toiletType && !item.occupant);
  if (!stall) { showToast(`目前没有空闲${toiletType === 'squat' ? '蹲厕' : '马桶'}`); return; }
  const index = game.queue.findIndex(item => item.id === characterId);
  if (index < 0) return;
  const girl = game.queue.splice(index, 1)[0];
  const patienceRatio = clamp(girl.patience / girl.effectiveMax, 0, 1);
  const entryTier = getEntryTier(patienceRatio);
  const entryQuote = getEntryQuote(girl, entryTier);
  game.stats.totalWait += girl.waitTime;
  game.stats.assignments += 1;
  stall.occupant = girl;
  const variance = .9 + Math.random() * .2;
  stall.timeLeft = getToiletDuration(girl, toiletType) * variance;
  stall.totalTime = stall.timeLeft;
  girl.entryTier = entryTier.label;
  girl.entryPatienceRatio = patienceRatio;
  girl.stallQuote = entryQuote;
  girl.stallQuoteUntil = game.elapsed + 28;
  girl.nextStallQuote = game.elapsed + 45 + Math.random() * 35;
  playSound('diarrhea');
  showToast(`${entryTier.icon} ${entryTier.label} · ${girl.name}：“${entryQuote}”`);
  renderGame();
}

function useSkill(skill) {
  if (!game || game.paused || game.skills[skill] <= 0) return;
  if (skill === 'comfort') {
    if (!game.queue.length) { showToast('队伍中暂时没有人需要安抚'); return; }
    const baseComfortRatio = .1 + .5 / game.queue.length;
    const elfPresent = game.queue.some(girl => girl.trait.id === 'elf');
    game.queue.forEach(girl => {
      const comfortRatio = baseComfortRatio * (girl.trait.id === 'professional' ? 1.4 : 1);
      girl.patience = Math.min(girl.effectiveMax, girl.patience + girl.effectiveMax * comfortRatio + (elfPresent && girl.trait.id !== 'elf' ? 60 : 0));
      girl.quote = withEmoji(COMFORT_DIALOGUES[girl.id] || '谢谢……感觉还能再坚持一下！', 'comfort');
      girl.nextQuote = Math.max(girl.nextQuote, game.elapsed + 24);
    });
    showToast(`安抚生效：每人基础恢复最大忍耐的 ${Math.round(baseComfortRatio * 1000) / 10}%`);
  } else if (skill === 'rush') {
    const occupied = game.stalls.filter(stall => stall.occupant);
    if (!occupied.length) { showToast('没有可以催促进度的隔间'); return; }
    const baseReduction = .1 + .3 / occupied.length;
    occupied.forEach(stall => {
      let reduction = baseReduction;
      if (stall.occupant.trait.id === 'rebel') reduction *= 1.7;
      if (stall.occupant.trait.id === 'apprentice') reduction *= 1.5;
      reduction = Math.min(.9, reduction);
      stall.timeLeft = Math.max(1, stall.timeLeft * (1 - reduction));
      stall.occupant.stallQuote = withEmoji(RUSH_DIALOGUES[stall.occupant.id] || '外面别催啦，我已经在尽快了！', 'inside');
      stall.occupant.stallQuoteUntil = game.elapsed + 24;
      stall.occupant.nextStallQuote = Math.max(stall.occupant.nextStallQuote, game.elapsed + 24);
    });
    showToast(`催促生效：每个隔间基础加速 ${Math.round(baseReduction * 1000) / 10}%`);
  } else return;
  game.skills[skill] -= 1;
  renderGame();
}

function renderGame() {
  if (!game) return;
  byId('screen-game').classList.toggle('big-icon-mode', game.bigIconMode);
  byId('btn-game-big').textContent = `大图标：${game.bigIconMode ? '开' : '关'}`;
  byId('game-time').textContent = formatTime(game.elapsed);
  byId('game-score').textContent = Math.round(game.stats.score).toLocaleString();
  byId('stat-success').textContent = game.stats.success;
  byId('stat-fail').textContent = game.stats.fail;
  byId('queue-count').textContent = `${game.queue.length} 人等待 · ${game.pending.length} 人未到`;
  byId('combo-status').textContent = `连救 ×${game.stats.combo}`;
  byId('wave-status').textContent = game.pending.length ? `第 ${Math.max(1, game.currentWave)} 波 · 下批 ${formatTime(game.pending[0].time - game.elapsed)}` : '所有客流已到达';
  byId('mission-progress-fill').style.width = `${((game.stats.success + game.stats.fail) / game.total) * 100}%`;
  const occupiedCount = game.stalls.filter(stall => stall.occupant).length;
  ['comfort', 'rush'].forEach(skill => {
    byId(`skill-${skill}-count`).textContent = game.skills[skill];
    const button = document.querySelector(`[data-skill="${skill}"]`);
    const hasTarget = skill === 'comfort' ? game.queue.length > 0 : skill === 'rush' ? occupiedCount > 0 : true;
    button.disabled = game.skills[skill] <= 0 || !hasTarget;
  });
  const comfortHint = document.querySelector('[data-skill="comfort"] small');
  comfortHint.textContent = game.queue.length
    ? `每人恢复 ${Math.round((.1 + .5 / game.queue.length) * 1000) / 10}%`
    : '排队区无人，暂不可用';
  const rushHint = document.querySelector('[data-skill="rush"] small');
  rushHint.textContent = occupiedCount
    ? `每间基础加速 ${Math.round((.1 + .3 / occupiedCount) * 1000) / 10}%`
    : '厕所无人，暂不可用';
  const sortButton = byId('btn-urgency-sort');
  sortButton.textContent = `紧急度排序：${game.urgencySort ? '开' : '关'}`;
  sortButton.classList.toggle('sort-active', game.urgencySort);
  const endButton = byId('btn-end-game');
  const readyToSettle = game.queue.length === 0 && game.pending.length === 0;
  endButton.textContent = readyToSettle ? '直接结算' : '放弃本局';
  endButton.classList.toggle('danger', !readyToSettle);
  endButton.classList.toggle('settle-ready', readyToSettle);
  renderQueue();
  renderStalls();
}
function renderQueue() {
  const container = byId('queue-container');
  const squatAvailable = game.stalls.some(stall => stall.type === 'squat' && !stall.occupant);
  const seatedAvailable = game.stalls.some(stall => stall.type === 'seated' && !stall.occupant);
  const sorted = game.urgencySort && game.queue.length > 1
    ? [game.queue[0], ...game.queue.slice(1).sort((a, b) => a.patience - b.patience || a.arrivalTime - b.arrivalTime)]
    : game.queue;
  container.replaceChildren();
  sorted.forEach(girl => {
    const ratio = clamp(girl.patience / girl.effectiveMax, 0, 1);
    const card = document.createElement('article');
    card.className = `girl-card${ratio < .35 ? ' critical' : ''}`;
    const barClass = ratio < .35 ? 'low' : ratio < .62 ? 'warning' : '';
    card.innerHTML = `<div class="dialogue" aria-label="${girl.name}说">${girl.quote}</div><div class="card-top"><div class="girl-avatar" style="background:${girl.color}"><img ${imageAttributes(getQueueFace(girl, ratio), girl.name)}></div><div class="girl-info"><div class="girl-name-row"><strong>${girl.name}</strong><span class="trait-chip">${girl.trait.icon} ${girl.trait.name}</span><span class="trait-inline-desc">${girl.trait.desc}</span></div><div class="girl-meta">剩余 ${formatTime(girl.patience)} · 蹲厕 ${formatTime(getToiletDuration(girl, 'squat'))} · 马桶 ${formatTime(getToiletDuration(girl, 'seated'))}</div><div class="bar-bg"><div class="bar-fill ${barClass}" style="width:${ratio * 100}%"></div></div></div></div>`;
    const actions = document.createElement('div');
    actions.className = 'assign-actions';
    const squatButton = document.createElement('button');
    squatButton.className = 'assign-button squat-button';
    squatButton.textContent = squatAvailable ? '安排蹲厕' : '蹲厕已满';
    squatButton.disabled = !squatAvailable;
    bindImmediateButton(squatButton, () => assignStall(girl.id, 'squat'));
    const seatedButton = document.createElement('button');
    seatedButton.className = 'assign-button seated-button';
    seatedButton.textContent = seatedAvailable ? '安排马桶' : '马桶已满';
    seatedButton.disabled = !seatedAvailable;
    bindImmediateButton(seatedButton, () => assignStall(girl.id, 'seated'));
    actions.append(squatButton, seatedButton);
    card.querySelector('.card-top').appendChild(actions);
    container.appendChild(card);
  });
  byId('queue-empty').hidden = game.queue.length > 0;
}
function renderStalls() {
  const container = byId('stall-container');
  container.replaceChildren();
  game.stalls.forEach(stall => {
    const card = document.createElement('article');
    card.className = `stall ${stall.type}`;
    const typeIcon = stall.type === 'squat' ? '🟩' : '🟪';
    card.innerHTML = `<div class="stall-status"><span>${stall.id + 1} 号</span><span>${typeIcon} ${stall.label}</span></div>`;
    if (stall.occupant) {
      const hasSpeech = Boolean(stall.occupant.stallQuote);
      const speech = `<div class="stall-speech${hasSpeech ? '' : ' empty'}">${hasSpeech ? stall.occupant.stallQuote : '&nbsp;'}</div>`;
      card.innerHTML += `<div class="entry-tier">${stall.occupant.entryTier}</div>${speech}<div class="stall-character"><img ${imageAttributes(getStateFace(stall.occupant, 'relaxed'), stall.occupant.name)}></div><div class="stall-name">${stall.occupant.name}</div><div class="stall-timer">剩余 ${formatTime(stall.timeLeft)}</div>`;
    } else {
      card.innerHTML += `<div class="stall-door">${stall.type === 'squat' ? '🚾' : '🚽'}</div><div class="stall-name">空闲可用</div>`;
    }
    container.appendChild(card);
  });
  const squatFree = game.stalls.filter(stall => stall.type === 'squat' && !stall.occupant).length;
  const seatedFree = game.stalls.filter(stall => stall.type === 'seated' && !stall.occupant).length;
  byId('stall-hint').textContent = `空闲：蹲厕 ${squatFree} · 马桶 ${seatedFree}`;
}

function quickSettleOccupied() {
  const occupied = game.stalls.filter(stall => stall.occupant);
  if (!occupied.length) return;
  game.elapsed += Math.max(...occupied.map(stall => stall.timeLeft));
  occupied.forEach(stall => rescueOccupant(stall));
}
function finishOrAbandonGame() {
  if (!game) return;
  if (game.queue.length === 0 && game.pending.length === 0) {
    if (game.timer) clearInterval(game.timer);
    quickSettleOccupied();
    finishGame();
    return;
  }
  if (!confirm('确定放弃本局吗？当前进度不会结算，也不会写入游玩纪录。')) return;
  goHome();
}
function calculateGrade(score, successRate, stars) {
  const normalized = score / Math.max(1, game.total);
  if (successRate === 1 && stars === 3 && normalized >= 185) return 'S';
  if (successRate >= .9 && normalized >= 145) return 'A';
  if (successRate >= .72) return 'B';
  if (successRate >= .5) return 'C';
  return 'D';
}
function finishGame() {
  if (!game || game.ended) return;
  game.ended = true;
  clearInterval(game.timer);
  stopAllSounds();
  const summary = { ...game.stats, elapsed: game.elapsed };
  const results = game.challenges.map(challenge => ({ ...challenge, passed: challenge.test(summary) }));
  const stars = results.filter(result => result.passed).length;
  const successRate = game.stats.success / game.total;
  const grade = calculateGrade(game.stats.score, successRate, stars);
  const recordKey = `${currentScene.id}_${settings.difficulty}`;
  const previous = saveData.records[recordKey];
  const score = Math.round(game.stats.score);
  if (!previous || score > previous.score) saveData.records[recordKey] = { sceneName: currentScene.name, difficulty: settings.difficulty, score, grade, stars, date: new Date().toISOString() };
  persist();
  byId('result-grade').textContent = grade;
  byId('res-title').textContent = `${currentScene.name} · ${DIFFICULTIES[settings.difficulty].name}难度`;
  byId('res-score').textContent = score.toLocaleString();
  byId('res-time').textContent = formatTime(game.elapsed);
  byId('res-success').textContent = game.stats.success;
  byId('res-fail').textContent = game.stats.fail;
  byId('res-average').textContent = formatTime(game.stats.totalWait / Math.max(1, game.stats.assignments));
  byId('res-combo').textContent = game.stats.maxCombo;
  const evaluations = {
    S: '调度近乎完美。你准确预判了客流、故障与每个人的极限，这里没有奇迹，只有可靠的判断。',
    A: '一次非常漂亮的救援。局面几度逼近失控，但你始终掌握着队伍真正的优先级。',
    B: '大部分人的尊严得以守住。再减少隔间空置和错误排序，就能把混乱变成秩序。',
    C: '你勉强控制住了事故规模，但仍有许多决定下得太晚。特性和技能需要用在关键节点。',
    D: '现场彻底失控。别急着乱点：先看忍耐比例、角色特性和隔间速度，再决定救援顺序。'
  };
  byId('res-eval').textContent = evaluations[grade];
  const challengeBox = byId('result-challenges');
  challengeBox.replaceChildren(...results.map(result => {
    const row = document.createElement('div');
    row.className = result.passed ? '' : 'failed';
    row.textContent = `${result.passed ? '★ 已完成' : '☆ 未完成'} · ${result.label}`;
    return row;
  }));
  const characterBox = byId('result-character-comments');
  const orderedOutcomes = [...game.outcomes].sort((a, b) => Number(b.success) - Number(a.success) || a.id - b.id);
  characterBox.replaceChildren(...orderedOutcomes.map(outcome => {
    const card = document.createElement('article');
    card.className = `result-character${outcome.success ? ' success' : ' failed'}`;
    const extraScoreText = outcome.extraScore ? ` · 额外得分 ${outcome.extraScore > 0 ? '+' : ''}${outcome.extraScore}` : '';
    const detail = outcome.success
      ? `${outcome.entryTier || '顺利入厕'} · ${outcome.toiletType === 'squat' ? '蹲厕' : '马桶'}${extraScoreText}`
      : (outcome.reason || '救援失败');
    card.innerHTML = `<img ${imageAttributes(outcome.face, outcome.name)}><div><div class="result-character-head"><strong>${outcome.name}</strong><span>${outcome.success ? '成功' : '失败'} · ${detail}</span></div><p>${outcome.comment}</p></div>`;
    return card;
  }));
  showScreen('screen-result');
}

function replay() {
  if (!currentScene) { goHome(); return; }
  startGame();
}
function showToast(message) {
  const toast = byId('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1900);
}
function exportSaveFile() {
  persist();
  const payload = {
    format: 'toilet-queue-crisis-save',
    version: 3,
    exportedAt: new Date().toISOString(),
    save: saveData
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `厕所排队模拟器存档-${date}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('JSON 存档已导出');
}
async function importSaveFile(file) {
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (payload?.format !== 'toilet-queue-crisis-save' || !payload.save) throw new Error('文件格式不正确');
    const imported = payload.save;
    saveData = {
      settings: { ...DEFAULT_SAVE.settings, ...(imported.settings || {}) },
      customScenes: Array.isArray(imported.customScenes) ? imported.customScenes.map(normalizeCustomScene) : [],
      characterOverrides: imported.characterOverrides || {},
      selectedVictims: Array.isArray(imported.selectedVictims) ? imported.selectedVictims.filter(id => Number.isInteger(id) && id >= 0 && id < 20) : [],
      records: imported.records || {}
    };
    settings = saveData.settings;
    selectedVictims = [...saveData.selectedVictims];
    scenes = [...BUILTIN_SCENES, ...saveData.customScenes];
    characters = buildCharacters();
    currentScene = null;
    persist();
    syncSettingsUI();
    renderSceneButtons();
    updateHomeRecord();
    showToast('JSON 存档导入成功');
  } catch (error) {
    console.error(error);
    alert(`无法导入存档：${error.message}`);
  } finally {
    byId('save-file-input').value = '';
  }
}
function resetAllSave() {
  if (!confirm('确定清除设置、自定义场景、角色参数和全部纪录吗？此操作不可撤销。')) return;
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem(LEGACY_SAVE_KEY);
  saveData = structuredClone(DEFAULT_SAVE);
  settings = saveData.settings;
  scenes = [...BUILTIN_SCENES];
  selectedVictims = [];
  characters = buildCharacters();
  currentScene = null;
  syncSettingsUI();
  renderSceneButtons();
  updateHomeRecord();
  showToast('全部本地存档已清除');
}

document.addEventListener('click', event => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action) {
    const actions = {
      'open-scenes': openScenes,
      'open-help': () => showScreen('screen-help'),
      'open-gallery': openGallery,
      'open-settings': () => { syncSettingsUI(); showScreen('screen-settings'); },
      home: goHome,
      'toggle-audio': () => toggleSetting('audio'),
      'toggle-experimental': () => toggleSetting('experimental'),
      'toggle-custom-victims': () => toggleSetting('customVictims'),
      'toggle-default-big-icons': () => toggleSetting('defaultBigIcons'),
      'toggle-default-urgency-sort': () => toggleSetting('defaultUrgencySort'),
      'toggle-original-assets': toggleOriginalAssets,
      'reset-characters': resetCharacters,
      'reset-save': resetAllSave,
      'export-save': exportSaveFile,
      'import-save': () => byId('save-file-input').click(),
      'toggle-custom-form': () => toggleCustomForm(),
      'cancel-custom': () => toggleCustomForm(false),
      'start-flow': beginStartFlow,
      'delete-scene': deleteCurrentScene,
      'back-scenes': () => showScreen('screen-scene'),
      'select-random': selectRandomVictims,
      'clear-selection': () => { selectedVictims = []; persist(); renderVictimSelection(); },
      'start-game': startGame,
      'toggle-gallery-big': toggleGalleryBigMode,
      'toggle-game-big': () => { if (game) { game.bigIconMode = !game.bigIconMode; renderGame(); } },
      'toggle-urgency-sort': () => { if (game) { game.urgencySort = !game.urgencySort; renderGame(); } },
      pause: togglePause,
      'finish-or-abandon': finishOrAbandonGame,
      replay
    };
    actions[action]?.();
  }
  const speed = event.target.closest('[data-speed]')?.dataset.speed;
  if (speed) setSpeed(speed);
  const skill = event.target.closest('[data-skill]')?.dataset.skill;
  if (skill) useSkill(skill);
  const galleryStateChoice = event.target.closest('[data-gallery-state]')?.dataset.galleryState;
  if (galleryStateChoice) setGalleryState(galleryStateChoice);
  const selection = event.target.closest('[data-character-id]');
  if (selection) toggleVictim(Number(selection.dataset.characterId));
});
document.addEventListener('keydown', event => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-character-id]')) {
    event.preventDefault();
    toggleVictim(Number(event.target.dataset.characterId));
  }
  if (event.key === ' ' && game && !event.target.matches('input, textarea, button, select, [data-character-id]')) {
    event.preventDefault();
    togglePause();
  }
});
document.addEventListener('change', event => {
  if (event.target.id === 'vol-slider') {
    settings.volume = Number(event.target.value);
    byId('vol-display').textContent = `${Math.round(settings.volume * 100)}%`;
    persist();
  } else if (event.target.id === 'difficulty-select') {
    settings.difficulty = event.target.value;
    byId('scene-difficulty').value = settings.difficulty;
    persist();
  } else if (event.target.id === 'scene-difficulty') {
    settings.difficulty = event.target.value;
    persist();
    renderChallengePreview();
  } else if (event.target.matches('[data-char][data-stat]')) {
    updateCharacterStat(event.target);
  } else if (event.target.id === 'girl-count') {
    event.target.value = clamp(Math.round(Number(event.target.value) || 3), 3, 20);
    renderChallengePreview();
  }
});
document.addEventListener('error', event => {
  if (!(event.target instanceof HTMLImageElement) || !event.target.dataset.fallback) return;
  const fallback = event.target.dataset.fallback;
  delete event.target.dataset.fallback;
  event.target.src = fallback;
}, true);
byId('custom-form').addEventListener('submit', applyCustomScene);
byId('save-file-input').addEventListener('change', event => importSaveFile(event.target.files?.[0]));
window.addEventListener('beforeunload', persist);

syncSettingsUI();
renderSceneButtons();
updateHomeRecord();
setManagedImage(document.querySelector('.mascot img'), characters[0].face);
setScreenBackground('screen-home', ORIGINAL_BG);
initializeWebThumbnails();
