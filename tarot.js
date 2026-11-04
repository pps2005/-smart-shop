/* tarot.js — ห้องดูดวงไพ่ยิปซี (แทนหน้าแมพร้าน) · ใช้ไพ่ Major Arcana 22 ใบ
   โต๊ะ 3 แบบ · แม่หมอสับ/ตัด/ให้หยิบไพ่ · เสียงพากย์ ไทย/เกาหลี/ญี่ปุ่น/จีน (ซับไทยเสมอ) */
(function () {
  'use strict';
  var LG = { th: 'th-TH', ko: 'ko-KR', ja: 'ja-JP', zh: 'zh-CN' }, L = 'th', MUTE = false, skip = null, RUN = 0, SAY = 0;
  var RM = '0 I II III IV V VI VII VIII IX X XI XII XIII XIV XV XVI XVII XVIII XIX XX XXI'.split(' ');
  function o(th, ko, ja, zh) { return { th: th, ko: ko, ja: ja, zh: zh }; }
  function rnd(n) { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
  function shuf(a) { for (var i = a.length - 1; i > 0; i--) { var j = rnd(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var $ = function (s) { return document.querySelector('#tr ' + s); };
  function el(c, h, p) { var d = document.createElement('div'); d.className = c; if (h) d.innerHTML = h; if (p) p.appendChild(d); return d; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ไพ่: [ไทย, เกาหลี, ญี่ปุ่น, จีน, สัญลักษณ์, ขั้วบวก(+1/0/-1), ความหมายตรง, ความหมายกลับหัว] */
  var CM = [
    ['เดอะฟูล (ผู้เริ่มต้น)', '바보', '愚者', '愚者', '🃏', 1, 'เริ่มต้นใหม่ กล้าเสี่ยงอย่างบริสุทธิ์ใจ', 'ประมาท ขาดแผน ระวังการตัดสินใจหุนหัน'],
    ['นักมายากล', '마법사', '魔術師', '魔术师', '🪄', 1, 'มีทุกอย่างพร้อมในมือ ลงมือแล้วสำเร็จ ใช้ความสามารถให้เต็มที่', 'ใช้ฝีมือผิดทาง หรือศักยภาพยังไม่ถูกใช้ ระวังคำลวง'],
    ['สตรีนักบวช', '여사제', '女教皇', '女祭司', '🌙', 0, 'ฟังเสียงภายใน ความลับยังไม่เปิดเผย อย่าเพิ่งรีบ', 'ปิดกั้นสัญชาตญาณ ความลับเริ่มรั่วไหล'],
    ['จักรพรรดินี', '여황제', '女帝', '皇后', '👑', 1, 'ความอุดมสมบูรณ์ ความรักอบอุ่น สิ่งที่ปลูกไว้งอกงาม', 'พึ่งพาคนอื่นเกินไป ลืมดูแลตัวเอง ความงอกงามชะงัก'],
    ['จักรพรรดิ', '황제', '皇帝', '皇帝', '🏛️', 0, 'ความมั่นคง ระเบียบ ผู้มีอำนาจช่วยหนุน', 'เข้มงวดเกินไป หรือถูกบีบด้วยอำนาจ'],
    ['สังฆราช', '교황', '教皇', '教皇', '📿', 0, 'ยึดแนวทางดั้งเดิม ขอคำปรึกษาจากผู้รู้', 'อึดอัดกับกฎเดิม อยากเดินทางของตัวเอง'],
    ['คู่รัก', '연인', '恋人', '恋人', '💞', 1, 'ความรักและการเลือกที่ตรงกับหัวใจ ความสัมพันธ์ลงตัว', 'ลังเลระหว่างทางเลือก ความสัมพันธ์ไม่สมดุล'],
    ['รถม้าศึก', '전차', '戦車', '战车', '🐎', 1, 'ชัยชนะจากความมุ่งมั่น คุมทิศทางได้', 'เสียการควบคุม ทิศทางสะเปะสะปะ'],
    ['พลัง', '힘', '力', '力量', '🦁', 1, 'ความใจเย็นเอาชนะแรงกล้า เข้มแข็งแต่อ่อนโยน', 'ขาดความมั่นใจ คุมอารมณ์ได้ยาก'],
    ['ฤๅษี', '은둔자', '隠者', '隐士', '🏮', 0, 'ถอยมาทบทวนตัวเอง หาปัญญาในความเงียบ', 'โดดเดี่ยวเกินไป หลบเลี่ยงการเผชิญหน้า'],
    ['กงล้อแห่งโชค', '운명의 수레바퀴', '運命の輪', '命运之轮', '🎡', 1, 'โชคเปลี่ยนไปในทางดี จังหวะมาถึงแล้ว', 'จังหวะติดขัดชั่วคราว ต้องรอวงล้อหมุน'],
    ['ความยุติธรรม', '정의', '正義', '正义', '⚖️', 0, 'เหตุและผลตรงไปตรงมา ตัดสินอย่างเป็นธรรม', 'ไม่เป็นธรรม หรือมีการเลี่ยงความรับผิดชอบ'],
    ['ผู้ถูกแขวน', '매달린 사람', '吊るされた男', '倒吊人', '🙃', 0, 'หยุดและมองมุมใหม่ ยอมเสียสละเพื่อได้มากกว่า', 'ติดแหง็ก เสียสละโดยไม่คุ้ม'],
    ['ความตาย (การเปลี่ยนผ่าน)', '죽음', '死神', '死神', '💀', -1, 'สิ่งเก่าจบเพื่อสิ่งใหม่ เปลี่ยนผ่านครั้งใหญ่ (ไม่ได้แปลว่าตายจริง)', 'ฝืนไม่ยอมปล่อย ยื้อสิ่งที่จบไปแล้ว'],
    ['ความพอดี', '절제', '節制', '节制', '🏺', 1, 'สมดุล ประนีประนอม ค่อยเป็นค่อยไป', 'สุดโต่ง ขาดความสมดุล'],
    ['ปีศาจ', '악마', '悪魔', '恶魔', '😈', -1, 'ติดกับดักความอยากหรือสัญญาเก่า ทั้งที่โซ่นั้นปลดได้', 'เริ่มหลุดจากพันธนาการ ปลดปล่อยตัวเอง'],
    ['หอคอย', '탑', '塔', '高塔', '⚡', -1, 'เหตุไม่คาดคิดที่พังของเดิม ก่อนสร้างใหม่ที่มั่นคงกว่า', 'วิกฤตเบาลงหรือเลี่ยงได้ แต่ยังกลัวการเปลี่ยนแปลง'],
    ['ดวงดาว', '별', '星', '星星', '⭐', 1, 'ความหวัง การเยียวยา แสงสว่างปลายทาง', 'หมดกำลังใจ ต้องเติมศรัทธาให้ตัวเอง'],
    ['พระจันทร์', '달', '月', '月亮', '🌕', -1, 'ความไม่ชัดเจน ความกลัวในใจ อย่าตัดสินใจตามอารมณ์', 'ความสับสนเริ่มคลี่คลาย ความจริงเผยออกมา'],
    ['พระอาทิตย์', '태양', '太陽', '太阳', '☀️', 1, 'ความสำเร็จ ความสุข พลังบวกเต็มที่', 'สุขชั่วคราว มั่นใจเกินจริง ยังไม่ถึงที่สุด'],
    ['การพิพากษา', '심판', '審判', '审判', '📯', 1, 'การตื่นรู้ ถึงเวลาตัดสินใจสำคัญ รับสิ่งที่สมควรได้', 'สงสัยตัวเอง พลาดสัญญาณเรียก'],
    ['โลก', '세계', '世界', '世界', '🌍', 1, 'ความสมบูรณ์ ปิดรอบสำเร็จ', 'ใกล้เสร็จแต่ยังขาดชิ้นสุดท้าย']
  ];

  /* ===== Major: คำสำคัญ ko/ja/zh [ตรง,กลับ] ===== */
  var KW = [
    ['새 출발','무모함','新たな出発','無謀','新开始','鲁莽'],['능력 발휘','속임수','才能の発揮','誤用','发挥才能','欺骗'],['직관','숨겨진 비밀이 샘','直感','秘密の漏洩','直觉','秘密外泄'],['풍요와 사랑','의존','豊穣と愛','依存','丰盛与爱','依赖'],
    ['안정','경직','安定','独裁','稳定','专制'],['전통과 조언','반항','伝統と助言','反発','传统与指引','叛逆'],['사랑과 선택','망설임','愛と選択','迷い','爱与选择','犹豫'],['승리','통제 상실','勝利','制御不能','胜利','失控'],
    ['인내와 용기','자신감 부족','忍耐と勇気','自信喪失','耐心与勇气','缺乏自信'],['성찰','고립','内省','孤立','反思','孤立'],['운이 바뀜','정체','運命の好転','停滞','转运','停滞'],['공정','불공정','公正','不公平','公正','不公'],
    ['새 관점','헛된 희생','視点の転換','無駄な犠牲','换个角度','白白牺牲'],['끝과 새 시작','집착','終わりと再生','執着','结束与新生','执着'],['균형','극단','調和','極端','平衡','极端'],['집착과 유혹','해방','執着と誘惑','解放','执念与诱惑','挣脱'],
    ['갑작스런 붕괴','위기 완화','突然の崩壊','危機の緩和','突变崩塌','危机减轻'],['희망과 치유','낙담','希望と癒し','落胆','希望与疗愈','气馁'],['불안과 혼란','혼란이 걷힘','不安と迷い','霧が晴れる','不安与迷惑','迷雾散去'],['성공과 기쁨','과신','成功と喜び','過信','成功与喜悦','过度自信'],
    ['각성과 결단','자기 의심','覚醒と決断','自己疑念','觉醒与抉择','自我怀疑'],['완성','마무리 부족','完成','仕上げ不足','圆满','尚欠一步']];
  /* ===== Minor Arcana 56 ใบ สร้างจากชุด × ลำดับ ===== */
  var SUITS = [['ไม้เท้า', '완드', 'ワンド', '权杖', '🔥', 'ด้านงานและแรงบันดาลใจ', '일과 열정', '仕事と情熱', '事业与热情'], ['ถ้วย', '컵', 'カップ', '圣杯', '💧', 'ด้านความรู้สึกและความรัก', '감정과 사랑', '感情と愛', '情感与爱'],
    ['ดาบ', '소드', 'ソード', '宝剑', '🗡️', 'ด้านความคิดและการตัดสินใจ', '생각과 결정', '思考と決断', '思想与决定'], ['เหรียญ', '펜타클', 'ペンタクル', '星币', '🪙', 'ด้านเงินและความมั่นคง', '돈과 안정', '金銭と安定', '金钱与安定']];
  var RN = ['เอซ,สอง,สาม,สี่,ห้า,หก,เจ็ด,แปด,เก้า,สิบ,เพจ,อัศวิน,ราชินี,ราชา'.split(','), '에이스,2,3,4,5,6,7,8,9,10,페이지,나이트,퀸,킹'.split(','), 'エース,2,3,4,5,6,7,8,9,10,ペイジ,ナイト,クイーン,キング'.split(','), '王牌,二,三,四,五,六,七,八,九,十,侍从,骑士,王后,国王'.split(',')];
  var RT = [['เริ่มต้นใหม่ โอกาสแรกมาถึง', 'โอกาสพลาดหรือล่าช้า'], ['สมดุลและต้องเลือก', 'ลังเล ไม่สมดุล'], ['ร่วมมือและงอกงาม', 'ขาดการประสานงาน'], ['มั่นคง พักตั้งหลัก', 'นิ่งเกินไป ติดขัด'], ['ความท้าทายและขัดแย้ง', 'ความขัดแย้งเริ่มคลี่คลาย'],
    ['ความช่วยเหลือ สิ่งต่างๆ ดีขึ้น', 'ยังติดอยู่กับอดีต'], ['ต้องอดทนและประเมินผล', 'ใจร้อน ท้อ'], ['ลงมือเคลื่อนไหว ฝีมือพัฒนา', 'เร่งรีบ ขาดโฟกัส'], ['ใกล้สำเร็จ พึ่งตนเองได้', 'เหนื่อยล้า ใกล้ถึงแต่อยากถอย'], ['ครบรอบ ผลสุดท้าย พร้อมภาระ', 'ภาระหนัก จบไม่สวย'],
    ['ข่าวสารใหม่ ความอยากรู้', 'ข่าวคลาดเคลื่อน ยังไม่สุก'], ['ลงมือเร็ว มุ่งไปข้างหน้า', 'บุ่มบ่าม'], ['เข้าใจ ใจกว้าง ดูแลคน', 'อารมณ์แปรปรวน'], ['ควบคุมได้ เป็นผู้นำ', 'ใช้อำนาจเกินไป']];
  var RK = [['새 기회','놓친 기회','新たな機会','機会を逃す','新机会','错失机会'],['균형과 선택','망설임','均衡と選択','迷い','平衡与抉择','犹豫'],['협력과 성장','조율 부족','協力と成長','連携不足','合作成长','协调不足'],['안정과 휴식','정체','安定と休息','停滞','稳定休整','停滞'],
    ['갈등과 도전','갈등 해소','対立と試練','和解','冲突挑战','化解冲突'],['도움과 호전','과거에 묶임','支援と好転','過去への執着','帮助好转','困于过去'],['인내와 평가','조급함','忍耐と見極め','焦り','耐心评估','急躁'],['활동과 기술','서두름','行動と熟練','焦燥','行动与技艺','仓促'],
    ['성취 직전','지침','達成間近','疲弊','接近成功','疲惫'],['완결과 부담','과중한 짐','完結と重責','重荷','圆满与负担','重担'],['소식과 호기심','미숙','知らせと好奇心','未熟','消息与好奇','不成熟'],['빠른 행동','경솔','迅速な行動','軽率','迅速行动','鲁莽'],
    ['이해와 포용','감정 기복','理解と包容','情緒不安定','理解包容','情绪多变'],['통제와 리더십','권위 남용','統率と指導力','権威の乱用','掌控领导','滥用权力']];
  var RP = [1, 0, 1, 0, -1, 1, 0, 1, 1, 0, 1, 0, 1, 0];
  var C = CM.slice();
  SUITS.forEach(function (su, si) {
    for (var r = 0; r < 14; r++) {
      var pol = si === 2 ? ([2, 4, 6, 8, 9].indexOf(r) >= 0 ? -1 : (r === 0 || r === 5 ? 1 : 0)) : RP[r];
      C.push([RN[0][r] + su[0], su[1] + ' ' + RN[1][r], su[2] + 'の' + RN[2][r], su[3] + RN[3][r], su[4], pol, RT[r][0] + ' (' + su[5] + ')', RT[r][1] + ' (' + su[5] + ')', { r: r, s: si }]);
    }
  });
  function lab(ci) { if (ci < 22) return RM[ci]; var r = (ci - 22) % 14; return r === 0 ? 'A' : r < 10 ? String(r + 1) : ['10', 'P', 'Kn', 'Q', 'K'][r - 9]; }
  function kw(ci, rev, li) { var c = C[ci], m = c[8]; if (!m) return KW[ci][li * 2 + rev]; return RK[m.r][li * 2 + rev] + ' (' + SUITS[m.s][6 + li] + ')'; }
  var LI = { ko: 0, ja: 1, zh: 2 };
  var OR = { u: o('ตรง', '정방향', '正位置', '正位'), r: o('กลับหัว', '역방향', '逆位置', '逆位') };
  var SP = {
    1: { n: 'โต๊ะไพ่ใบเดียว', ic: '🕯️', d: 'คำตอบของวันนี้', a: ['b'], p: [o('คำตอบของวัน', '오늘의 답', '今日の答え', '今日之答')],
      ex: o('โต๊ะนี้ใช้ไพ่ใบเดียว ตามตำราใช้ตอบคำถามเดียวให้ชัด ขั้นตอนคือ ถาม สับไพ่ ตัดไพ่ แล้วให้ลูกหยิบหนึ่งใบ', '이 탁자는 카드 한 장으로 하나의 질문에 답합니다. 묻고, 섞고, 자르고, 한 장을 뽑으세요.', 'このテーブルは一枚引き。一つの問いに答えます。質問、シャッフル、カット、一枚選びます。', '此牌桌只抽一张牌，回答一个问题。先提问、洗牌、切牌，再抽一张。') },
    3: { n: 'โต๊ะสามใบ', ic: '🔮', d: 'อดีต · ปัจจุบัน · อนาคต', a: ['l', 'b', 'r'], p: [o('อดีต', '과거', '過去', '过去'), o('ปัจจุบัน', '현재', '現在', '现在'), o('อนาคต', '미래', '未来', '未来')],
      ex: o('โต๊ะสามใบ อ่านเป็นเรื่องราวต่อเนื่อง อดีต ปัจจุบัน อนาคต ขั้นตอนคือ ถามสามข้อ สับ ตัด หยิบสามใบ แล้วพลิกทีละใบ', '세 장 탁자는 과거, 현재, 미래를 이야기처럼 읽습니다. 질문 세 개, 섞기, 자르기, 세 장 뽑기 순서입니다.', '三枚のテーブルは過去・現在・未来を物語として読みます。質問三つ、シャッフル、カット、三枚引きます。', '三张牌桌按过去、现在、未来连贯解读。问三个问题，洗牌、切牌，抽三张。') },
    5: { n: 'โต๊ะกากบาทห้าใบ', ic: '✨', d: 'เรื่องซับซ้อน ถามละเอียด', a: ['b', 't', 'l', 'r', 'd'], p: [o('ตัวเรา', '나', '自分', '自己'), o('อุปสรรค', '장애', '障害', '阻碍'), o('รากของเรื่อง', '뿌리', '根っこ', '根源'), o('คำแนะนำ', '조언', '助言', '建议'), o('ผลลัพธ์', '결과', '結果', '结果')],
      ex: o('โต๊ะกากบาทห้าใบ ตัวเรา อุปสรรค รากของเรื่อง คำแนะนำ ผลลัพธ์ เหมาะกับเรื่องซับซ้อน แม่จะถามละเอียดก่อนสับไพ่', '다섯 장 십자 탁자: 나, 장애, 뿌리, 조언, 결과. 복잡한 일에 맞습니다. 먼저 자세히 묻겠습니다.', '五枚の十字テーブル。自分、障害、根っこ、助言、結果。複雑な件向きです。先に詳しく伺います。', '五张十字牌桌：自己、阻碍、根源、建议、结果。适合复杂的事，我会先仔细询问。') },
    7: { n: 'โต๊ะเกือกม้าเจ็ดใบ', ic: '🧲', d: 'ตามตำรา: มองรอบด้านของเรื่อง', a: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], p: [o('อดีต', '과거', '過去', '过去'), o('ปัจจุบัน', '현재', '現在', '现在'), o('สิ่งที่ซ่อนอยู่', '숨은 요인', '隠れた要因', '隐藏因素'), o('ตัวเรา', '나', '自分', '自己'), o('คนรอบข้าง', '주변 사람', '周囲の人', '周围的人'), o('อุปสรรค', '장애', '障害', '阻碍'), o('ผลลัพธ์', '결과', '結果', '结果')],
      ex: o('โต๊ะเกือกม้าเจ็ดใบ เรียงเป็นรูปตัวยู มองเรื่องรอบด้าน อดีต ปัจจุบัน สิ่งที่ซ่อนอยู่ ตัวเรา คนรอบข้าง อุปสรรค ผลลัพธ์ แม่จะถามละเอียดและถามย้ำระหว่างอ่าน', '말발굽 탁자는 일곱 장을 U자로 놓아 일을 두루 봅니다. 자세히 묻고 읽는 중에도 확인하겠습니다.', '馬蹄形は七枚をU字に並べ、全体を見渡します。詳しく伺い、読みながら確認もします。', '马蹄形牌阵七张呈U形，全面看事情。我会细问，读牌时也会再确认。') },
    10: { n: 'โต๊ะเซลติกครอส 10 ใบ', ic: '🗝️', d: 'วิธีคลาสสิกที่ละเอียดที่สุด', a: ['c', 'c', 'd', 'p', 'g', 'f', 's', 'e', 'h', 'o'], p: [o('ปัจจุบัน', '현재', '現在', '现在'), o('อุปสรรคที่ตัดผ่าน', '가로막는 것', '交差する障害', '交叉阻碍'), o('รากฐานของเรื่อง', '기반', '土台', '根基'), o('อดีตที่เพิ่งผ่านมา', '최근의 과거', '近い過去', '近期过去'), o('เป้าหมายเหนือศีรษะ', '목표', '目標', '目标'), o('อนาคตอันใกล้', '가까운 미래', '近い未来', '近期未来'),
        o('ท่าทีของเรา', '나의 태도', '自分の態度', '自己的态度'), o('สิ่งแวดล้อม', '주변 환경', '周囲の環境', '周围环境'), o('ความหวังและความกลัว', '희망과 두려움', '希望と恐れ', '希望与恐惧'), o('ผลลัพธ์', '결과', '結果', '结果')],
      ex: o('เซลติกครอสสิบใบ คือวิธีคลาสสิกที่สุด หกใบแรกเป็นกากบาท สี่ใบหลังเรียงเป็นแท่ง ใบที่สองวางขวางทับใบแรกคืออุปสรรค แม่จะถามหลายข้อและถามย้ำระหว่างอ่านให้แม่นขึ้น', '켈틱 크로스는 가장 고전적인 방법입니다. 앞의 여섯 장은 십자, 뒤의 네 장은 기둥입니다. 두 번째 카드는 첫 카드를 가로질러 장애를 뜻합니다.', 'ケルト十字は最も古典的な方法。最初の六枚が十字、残り四枚が縦の列。二枚目は一枚目に交差し障害を表します。', '凯尔特十字是最经典的牌阵。前六张成十字，后四张成一列。第二张横压第一张，代表阻碍。') }
  };
  var T = {
    hi: o('ยินดีต้อนรับสู่โต๊ะดูดวงของแม่นะลูก นั่งก่อน แล้วเลือกโต๊ะไพ่ที่อยากดู', '어서 오렴. 앉아서 보고 싶은 탁자를 고르렴.', 'いらっしゃい。お座りなさい。見たいテーブルをお選び。', '欢迎来到老身的占卜桌。请坐，选一张想看的牌桌。'),
    qt: o('เรื่องที่ลูกอยากถามคือเรื่องอะไร เลือกหรือพิมพ์บอกแม่ก็ได้', '무엇이 궁금하니? 고르거나 적어 주렴.', '何を占いたいの？選ぶか書いてください。', '想问什么事？可以选，也可以写下来。'),
    qf: o('ตอนนี้ในใจลูกรู้สึกอย่างไรกับเรื่องนี้', '지금 이 일에 대해 마음이 어떠니?', '今、このことをどう感じていますか。', '现在你对这件事心里是什么感觉？'),
    qw: o('อยากรู้ผลในช่วงเวลาไหน', '언제쯤의 결과가 궁금하니?', 'いつ頃の結果を知りたいですか。', '想知道什么时候的结果？'),
    sh: o('หลับตา ตั้งจิตนึกถึงคำถาม แม่จะสับไพ่ให้', '눈을 감고 질문을 떠올리렴. 내가 카드를 섞으마.', '目を閉じて問いを思い浮かべて。カードを切ります。', '闭上眼想着问题，老身来洗牌。'),
    cut: o('ตามตำราต้องตัดไพ่ด้วยมือซ้าย เลือกกองที่ใจเรียกเลย', '전통대로 왼손으로 자르렴. 마음이 끌리는 더미를 고르렴.', '作法では左手でカット。心が引かれる山をお選び。', '按古法用左手切牌，选心里感应的那一叠。'),
    pk: o('แตะไพ่ที่ใจเรียกตามจำนวนที่ต้องใช้', '마음이 부르는 카드를 필요한 만큼 누르렴.', '心が呼ぶカードを必要な枚数だけ選んで。', '点按心里呼唤的牌，抽够所需张数。'),
    done: o('ครบแล้ว เรามาพลิกไพ่ทีละใบกัน', '다 뽑았구나. 한 장씩 뒤집어 보자.', '揃いました。一枚ずつめくりましょう。', '抽齐了，我们一张张翻开。')
  };
  var TOP = ['💕 ความรัก', '💼 งานและเงิน', '🌿 ชีวิตทั่วไป'], FEEL = ['😟 กังวล', '😵 สับสน', '🌱 มีความหวัง'], TIME = ['ไม่กี่สัปดาห์', 'ราว 3 เดือน', 'ภายในปีนี้'];
  var TN = ['เรื่องหัวใจ', 'เรื่องงานเงิน', 'ภาพรวมชีวิต'];
  var TONE = [o('ภาพรวมค่อนข้างต้องระวัง', '전체 흐름은 조심이 필요합니다.', '全体に慎重さが必要です。', '整体需要谨慎。'), o('ภาพรวมมีทั้งดีและท้าทาย', '전체는 좋고 어려운 점이 섞여 있습니다.', '全体は良い面と課題が混在します。', '整体好坏参半。'), o('ภาพรวมเป็นไปในทางดี', '전체 흐름은 긍정적입니다.', '全体は良い流れです。', '整体趋势良好。')];

  var CSS = '#tr{position:fixed;inset:0;z-index:9999;display:none;flex-direction:column;background:radial-gradient(120% 80% at 50% 0,#2a1250,#0e0718);color:#f6ecd0;font-family:"Noto Serif Thai","Sarabun",Georgia,serif;-webkit-tap-highlight-color:transparent}#tr.on{display:flex}' +
    '#tr button{font:inherit;color:inherit;cursor:pointer;touch-action:manipulation}.trh{display:flex;gap:6px;align-items:center;padding:calc(8px + env(safe-area-inset-top,0px)) 10px 4px}.trh b{flex:1;font-size:1.05rem;letter-spacing:.02em}' +
    '.trh button{border:1px solid #c9993a88;background:#ffffff10;border-radius:16px;padding:5px 10px;font-size:.82rem}.trh button.on{background:#c9993a;color:#2b1744;font-weight:700}' +
    '.stg{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center}.tl{width:min(30vw,130px);flex:none}.tl svg{width:100%;display:block;animation:br 4s ease-in-out infinite}@keyframes br{50%{transform:translateY(2px) scale(1.01)}}' +
    '#tm{transform-origin:60px 71px}.tl.talk #tm{animation:mo .26s infinite alternate}@keyframes mo{from{transform:scaleY(.3)}to{transform:scaleY(1.5)}}.hd{transition:transform .3s}.tl.shk .hl{animation:hl .22s infinite alternate}.tl.shk .hr{animation:hr .22s infinite alternate}@keyframes hl{to{transform:translate(8px,-10px)}}@keyframes hr{to{transform:translate(-8px,-10px)}}' +
    '.tbl{flex:1;min-height:0;width:calc(100% - 12px);position:relative;overflow:auto;border-radius:44% 44% 0 0 / 12% 12% 0 0;border:6px solid #5b3417;border-bottom:0;box-shadow:inset 0 0 40px #0009,0 -4px 18px #000a;display:flex;flex-direction:column;align-items:center;justify-content:safe center;gap:10px;padding:14px 8px;background:radial-gradient(circle at 50% 40%,var(--f1),var(--f2))}' +
    '.tbl.t1{--f1:#1f6b4a;--f2:#0d3a29}.tbl.t3{--f1:#7a1f3a;--f2:#3a0b1c}.tbl.t5{--f1:#2c3a8a;--f2:#10153d}.tbl.t7{--f1:#6b4a12;--f2:#2e1d05}.tbl.t10{--f1:#1a5a6b;--f2:#08222b}.tbl.t7 .bd{--w:min(17vw,66px);grid-template-areas:"a . g" "b . f" "c d e";grid-template-columns:repeat(3,var(--w))}.tbl.t10 .bd{--w:min(13vw,54px);gap:8px;grid-template-areas:". g . o" "p c f h" ". d . e" ". . . s";grid-template-columns:repeat(4,var(--w))}.tbl.t0{--f1:#3a2257;--f2:#150a26}' +
    '.bd{display:grid;gap:10px;--w:min(21vw,88px)}.tbl.t5 .bd{--w:min(15vw,62px);grid-template-areas:". t ." "l b r" ". d .";grid-template-columns:repeat(3,var(--w))}.tbl.t3 .bd{grid-template-columns:repeat(3,var(--w))}.tbl.t1 .bd{grid-template-columns:var(--w);--w:min(26vw,104px)}' +
    '.sl{width:var(--w);aspect-ratio:5/8;border:1.5px dashed #f6ecd055;border-radius:8px;position:relative;grid-area:var(--a)}.pl{position:absolute;top:100%;left:50%;transform:translateX(-50%);font-size:.66rem;white-space:nowrap;margin-top:2px;color:#e8d49a}' +
    '.cd{width:100%;height:100%;container-type:inline-size;perspective:600px;position:absolute;inset:0}.in{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .8s}.cd.fl .in{transform:rotateY(180deg)}' +
    '.bk,.ft{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:7px;border:2px solid #c9993a;box-shadow:0 3px 8px #0008}.bk{background:radial-gradient(circle,#c9993a 0 7%,transparent 8%),repeating-conic-gradient(#3b1b63 0 15deg,#2a1248 0 30deg)}' +
    '.ft{transform:rotateY(180deg);background:#f3e3b8;color:#2b1744}.ft span{display:flex;flex-direction:column;align-items:center;justify-content:space-between;height:100%;padding:6% 3%;text-align:center}.cd.rv .ft span{transform:rotate(180deg)}.ft b{font-size:15cqw}.ft i{font-style:normal;font-size:44cqw;line-height:1}.ft small{font-size:12cqw;line-height:1.15}' +
    '.sh{position:relative;width:min(22vw,90px);aspect-ratio:5/8}.sh .cd{transition:none}.sh.go .cd:nth-child(odd){animation:r1 .45s ease-in-out infinite alternate}.sh.go .cd:nth-child(even){animation:r2 .45s ease-in-out infinite alternate}@keyframes r1{to{transform:translateX(-45%) rotate(-10deg)}}@keyframes r2{to{transform:translateX(45%) rotate(10deg)}}' +
    '.piles{display:flex;gap:18px}.pile{position:relative;width:min(22vw,84px);aspect-ratio:5/8;border:0;background:none;padding:0}.pile .cd:nth-child(2){transform:translate(2px,-2px)}.pile .cd:nth-child(3){transform:translate(4px,-4px)}.fan{display:flex;justify-content:center;padding-top:6px}.fan .cd{position:relative;width:min(15vw,62px);aspect-ratio:5/8;height:auto;margin-left:calc(min(15vw,62px) * var(--ov,-.5));cursor:pointer;transition:transform .25s}.fan .cd:first-child{margin-left:0}.fan .cd:hover{transform:translateY(-8px)}.fan .cd.used{visibility:hidden}' +
    '.pn{flex:none;padding:8px 12px calc(10px + env(safe-area-inset-bottom,0px));background:#0b0614;border-top:1px solid #c9993a66;max-height:40vh;overflow:auto}.sub{font-size:1rem;line-height:1.55;min-height:3.1em;margin-bottom:6px}.sub small{display:block;opacity:.6;font-size:.72rem}' +
    '.ch{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:6px}.ch button{flex:1 1 30%;border:1px solid #c9993a;background:#c9993a22;border-radius:12px;padding:9px 6px;font-size:.92rem}.ch button:active{background:#c9993a}.ch button b{display:block}.ch button small{opacity:.7;font-size:.72rem}' +
    '.ip{display:flex;gap:6px}.ip input{flex:1;font:inherit;font-size:16px;border-radius:12px;border:1px solid #c9993a88;background:#ffffff12;color:inherit;padding:8px 10px;outline:0}.ip button{border:0;background:#c9993a;color:#2b1744;border-radius:12px;padding:0 14px;font-weight:700}' +
    '#trbtn{position:fixed;right:14px;bottom:calc(86px + env(safe-area-inset-bottom,0px));z-index:40;width:54px;height:54px;border-radius:50%;border:2px solid #c9993a;background:radial-gradient(circle at 35% 30%,#7b3fc4,#2a1250);font-size:1.6rem;box-shadow:0 4px 14px #0007;cursor:pointer}@media(prefers-reduced-motion:reduce){.tl svg,.sh.go .cd,.tl.shk .hd{animation:none!important}}';

  var TELLER = '<svg viewBox="0 0 120 135"><path d="M14 135c2-34 20-46 46-46s44 12 46 46z" fill="#5a1f7a"/><path d="M38 100q22 14 44 0" stroke="#e0b24a" stroke-width="3" fill="none"/><path d="M60 8C30 8 20 34 22 60c3 6 12 8 38 8s35-2 38-8C100 34 90 8 60 8z" fill="#8c2f5a"/><path d="M26 28q34-26 68 0" stroke="#e0b24a" stroke-width="3" fill="none"/><ellipse cx="60" cy="52" rx="23" ry="26" fill="#e8b98c"/><path d="M36 38q24-18 48 0q-8-4-24-4t-24 4z" fill="#8c2f5a"/><circle cx="51" cy="50" r="2.6" fill="#2b1744"/><circle cx="69" cy="50" r="2.6" fill="#2b1744"/><path d="M45 44q6-4 11 0M64 44q6-4 11 0" stroke="#2b1744" stroke-width="1.5" fill="none"/><ellipse id="tm" cx="60" cy="71" rx="6" ry="2.6" fill="#8a2230"/><circle cx="36" cy="62" r="3.5" fill="#e0b24a"/><circle cx="84" cy="62" r="3.5" fill="#e0b24a"/>' +
    '<g class="hd hl"><circle cx="38" cy="116" r="9" fill="#e8b98c"/><circle cx="38" cy="116" r="4" fill="#e0b24a"/></g><g class="hd hr"><circle cx="82" cy="116" r="9" fill="#e8b98c"/><circle cx="82" cy="116" r="4" fill="#e0b24a"/></g></svg>';

  function build() {
    if (document.getElementById('tr')) return;
    var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
    var r = el('', ''); r.id = 'tr';
    r.innerHTML = '<div class="trh"><b>🔮 ดูดวงไพ่ยิปซี</b><button data-l="th" class="on">ไทย</button><button data-l="ko">한국어</button><button data-l="ja">日本語</button><button data-l="zh">中文</button><button id="trm" aria-label="เสียง">🔊</button><button id="trx" aria-label="ปิด">✕</button></div>' +
      '<div class="stg"><div class="tl">' + TELLER + '</div><div class="tbl t0"></div></div><div class="pn"><div class="sub"></div><div class="ch"></div><div class="ip" style="display:none"><input placeholder="หรือพิมพ์ตอบแม่หมอที่นี่..." autocomplete="off"><button>ส่ง</button></div></div>';
    document.body.appendChild(r);
    r.querySelector('.trh').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.l) { L = b.dataset.l; [].forEach.call(r.querySelectorAll('[data-l]'), function (x) { x.classList.toggle('on', x === b); }); if (window.speechSynthesis) speechSynthesis.cancel(); }
      else if (b.id === 'trm') { MUTE = !MUTE; b.textContent = MUTE ? '🔇' : '🔊'; if (MUTE && window.speechSynthesis) speechSynthesis.cancel(); }
      else if (b.id === 'trx') close();
    });
    $('.sub').addEventListener('click', function () { if (skip) skip(); });
    var f = document.createElement('button'); f.id = 'trbtn'; f.textContent = '🔮'; f.setAttribute('aria-label', 'ดูดวงไพ่ยิปซี'); f.onclick = open; document.body.appendChild(f);
  }
  function open() { build(); $('').classList.add('on'); run(); }
  function close() { RUN++; if (window.speechSynthesis) speechSynthesis.cancel(); document.getElementById('tr').classList.remove('on'); }

  function teller(on, shake) { var t = $('.tl'); t.classList.toggle('talk', !!on); t.classList.toggle('shk', !!shake); }
  function say(x) {
    var tx = x[L] || x.th; $('.sub').innerHTML = x.th + (L !== 'th' ? '<small>' + tx + '</small>' : '');
    return new Promise(function (res) {
      var sp = !MUTE && window.speechSynthesis, tm, done = 0, id = ++SAY;
      function fin() { if (done) return; done = 1; clearTimeout(tm); if (id === SAY) { skip = null; teller(0); } res(); }
      skip = function () { fin(); if (sp) speechSynthesis.cancel(); }; teller(1);
      tm = setTimeout(fin, sp ? tx.length * 380 + 4000 : Math.max(1500, tx.length * (L === 'th' ? 55 : 150)));
      if (!sp) return;
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(tx); u.lang = LG[L]; u.rate = .9; u.pitch = 1.05;
      var v = speechSynthesis.getVoices().filter(function (q) { return q.lang.replace('_', '-').indexOf(LG[L].slice(0, 2)) === 0; })[0]; if (v) u.voice = v;
      u.onend = fin; u.onerror = fin; speechSynthesis.speak(u);
    });
  }
  /* ถามคำถาม: ปุ่มเลือก 3 ข้อ หรือพิมพ์ตอบ → {i: ลำดับ หรือ -1, t: ข้อความ} */
  function ask(q, opts) {
    return new Promise(function (res) {
      var ch = $('.ch'), ip = $('.ip'), inp = ip.querySelector('input'); ch.innerHTML = ''; ip.style.display = 'flex'; inp.value = '';
      function pick(a) { ch.innerHTML = ''; ip.style.display = 'none'; res(a); }
      opts.forEach(function (t, i) { var b = document.createElement('button'); b.textContent = t; b.onclick = function () { pick({ i: i, t: t }); }; ch.appendChild(b); });
      function send() { var v = inp.value.trim(); if (v) pick({ i: -1, t: v }); }
      ip.querySelector('button').onclick = send; inp.onkeydown = function (e) { if (e.key === 'Enter') send(); };
      say(q);
    });
  }
  function choose(items) { /* items: [{h, s}] → index */
    return new Promise(function (res) {
      var ch = $('.ch'); ch.innerHTML = '';
      items.forEach(function (it, i) { var b = document.createElement('button'); b.innerHTML = '<b>' + it.h + '</b><small>' + it.s + '</small>'; b.onclick = function () { ch.innerHTML = ''; res(i); }; ch.appendChild(b); });
    });
  }

  async function run() {
    var my = ++RUN, ck = function () { if (my !== RUN) throw 0; };
    try {
      var tb = $('.tbl'); tb.className = 'tbl t0'; tb.innerHTML = '<div style="font-size:3rem;filter:drop-shadow(0 0 14px #c9993a)">🔮</div><div style="opacity:.8">เลือกโต๊ะที่ต้องการ</div>';
      var ans = { t: -1 }, hi = say(T.hi);
      var keys = [1, 3, 5, 7, 10], k = await choose(keys.map(function (n) { return { h: SP[n].ic + ' ' + SP[n].n, s: SP[n].d }; })); ck();
      var sp = SP[keys[k]], n = keys[k]; if (window.speechSynthesis) speechSynthesis.cancel();
      tb.className = 'tbl t' + n; tb.innerHTML = ''; var bd = el('bd', '', tb), slots = [];
      sp.a.forEach(function (a, i) { var s = el('sl', '<div class="pl">' + sp.p[i].th + '</div>', bd); if (n >= 5) s.style.gridArea = a; if (n === 10 && i === 1) { s.style.transform = 'rotate(90deg)'; s.style.zIndex = 3; s.firstChild.style.display = 'none'; } slots.push(s); });
      await say(sp.ex); ck();
      var qt = await ask(T.qt, TOP); ck();
      var topic = qt.i >= 0 ? qt.i : /รัก|แฟน|คู่|สัมพันธ์|แต่งงาน|love/i.test(qt.t) ? 0 : /งาน|เงิน|ธุรกิจ|เลื่อน|ลงทุน|ขาย|หนี้/.test(qt.t) ? 1 : 2;
      var ff = await ask(T.qf, FEEL); ck();
      var tw = TIME[1]; if (n > 1) { var tt = await ask(T.qw, TIME); ck(); tw = tt.i >= 0 ? tt.t : tt.t; }
      /* สับไพ่ */
      var sh = el('sh', '', tb); for (var i = 0; i < 8; i++) el('cd', '<div class="in"><div class="bk"></div></div>', sh);
      var sg = say(T.sh); await wait(1400); sh.classList.add('go'); teller(1, 1); await sg; ck(); await wait(600); sh.classList.remove('go'); teller(0, 0); ck();
      var deck = shuf(C.map(function (c, i) { return i; }));
      /* ตัดไพ่ 3 กอง */
      sh.remove(); var pl = el('piles', '', tb); for (var p = 0; p < 3; p++) { var pb = document.createElement('button'); pb.className = 'pile'; for (var q = 0; q < 3; q++) el('cd', '<div class="in"><div class="bk"></div></div>', pb); pl.appendChild(pb); }
      say(T.cut); var cut = await new Promise(function (res) { [].forEach.call(pl.children, function (b, i) { b.onclick = function () { res(i); }; }); }); ck(); pl.remove();
      deck = deck.slice(cut * 26).concat(deck.slice(0, cut * 26));
      /* หยิบไพ่ */
      var fan = el('fan', '', tb), picked = [];
      var FN = n > 5 ? 14 : 10; fan.style.setProperty('--ov', n > 5 ? '-.66' : '-.5');
      for (var j = 0; j < FN; j++) { var fc = el('cd', '<div class="in"><div class="bk"></div></div>', fan); fc.style.transform = 'rotate(' + ((j - (FN - 1) / 2) * 4) + 'deg)'; fc.dataset.j = j; }
      say({ th: 'แตะไพ่ที่ใจเรียก ' + n + ' ใบ', ko: n + '장을 뽑으렴.', ja: n + '枚選んでください。', zh: '请抽' + n + '张。' });
      await new Promise(function (res) {
        fan.onclick = function (e) {
          var f = e.target.closest('.cd'); if (!f || f.classList.contains('used') || picked.length >= n) return;
          var ci = deck[+f.dataset.j], rev = rnd(2) === 1, r0 = f.getBoundingClientRect(); f.classList.add('used');
          var s = slots[picked.length], card = el('cd' + (rev ? ' rv' : ''), '<div class="in"><div class="bk"></div><div class="ft"><span><b>' + lab(ci) + '</b><i>' + C[ci][4] + '</i><small>' + C[ci][0] + '</small></span></div></div>', s);
          var r1 = s.getBoundingClientRect(); card.style.transition = 'none'; card.style.zIndex = 5; card.style.transform = 'translate(' + (r0.left - r1.left) + 'px,' + (r0.top - r1.top) + 'px) scale(.9)';
          card.getBoundingClientRect(); card.style.transition = 'transform .6s cubic-bezier(.2,.8,.2,1)'; card.style.transform = 'none';
          picked.push({ c: ci, r: rev, e: card }); if (picked.length === n) res();
        };
      }); ck(); await wait(700); fan.remove(); await say(T.done); ck();
      /* พลิกอ่านทีละใบ */
      var sc = 0, tp = TN[topic], fit = -2;
      for (var m = 0; m < n; m++) {
        var d = picked[m], c = C[d.c], pos = sp.p[m]; d.e.classList.add('fl'); await wait(850);
        sc += d.r ? -c[5] : c[5];
        var th = pos.th + ': ' + c[0] + ' (' + OR[d.r ? 'r' : 'u'].th + ') — ' + (d.r ? c[7] : c[6]) + (topic === 0 ? ' ในเรื่องหัวใจ ให้ดูที่ความรู้สึกจริงของทั้งสองฝ่าย' : topic === 1 ? ' ในเรื่องงานเงิน ให้ดูที่ความพร้อมและจังหวะ' : '');
        var oo = OR[d.r ? 'r' : 'u'];
        await say({ th: th, ko: pos.ko + ', ' + c[1] + ', ' + oo.ko + '. ' + kw(d.c, +d.r, 0) + '.', ja: pos.ja + '、' + c[2] + '、' + oo.ja + '。' + kw(d.c, +d.r, 1) + '。', zh: pos.zh + '，' + c[3] + '，' + oo.zh + '。' + kw(d.c, +d.r, 2) + '。' }); ck();
        if (m === 0 && n >= 3) { /* ถามย้ำให้คำทำนายแม่นขึ้น */
          var ft = await ask(o('ไพ่ใบนี้ตรงกับสถานการณ์จริงของลูกไหม', '이 카드가 네 상황과 맞니?', 'このカードは実際の状況に合っていますか。', '这张牌符合你的实际情况吗？'), ['✅ ตรงมาก', '🤏 ตรงบางส่วน', '❌ ไม่ค่อยตรง']); ck(); fit = ft.i;
          await say({ th: fit === 0 ? 'ดีมาก ไพ่จูนกับเรื่องของลูกแล้ว แม่จะอ่านต่อ' : fit === 1 ? 'งั้นแม่จะอ่านต่อโดยเน้นด้านที่ตรงกับลูก' : fit === 2 ? 'ไม่เป็นไร บางทีไพ่สะท้อนด้านที่ลูกยังไม่ได้มอง ลองคิดตามไปด้วยนะ' : 'ขอบคุณที่บอกแม่ แม่จะปรับการอ่านตามนี้', ko: '알겠다. 네 말에 맞춰 계속 읽으마.', ja: 'わかりました。お話に合わせて読み進めます。', zh: '明白了，我会按你说的继续解读。' }); ck(); }
      }
      var av = sc / n, tone = av <= -.25 ? 0 : av >= .4 ? 2 : 1, fe = ff.i === 0 ? 'แม่เห็นว่าลูกกังวลอยู่ ' : ff.i === 1 ? 'แม่เห็นว่าลูกกำลังสับสน ' : ff.i === 2 ? 'ลูกมีความหวังอยู่ ' : 'ที่ลูกบอกว่า “' + ff.t + '” ';
      var adv = ['ให้ดูแลใจและพักผ่อนให้พอ', 'ให้วางแผนเป็นขั้นและอย่าตัดสินใจตอนอารมณ์พุ่ง', 'ให้พูดความรู้สึกตรงๆ และฟังอีกฝ่ายด้วย'][topic === 0 ? 2 : topic === 1 ? 1 : 0];
      var end = fe + 'สำหรับ' + tp + 'ในช่วง' + tw + ' ' + TONE[tone].th + ' ' + adv + (fit === 2 ? ' ไพ่ใบแรกลูกว่าไม่ค่อยตรง จึงให้ถือคำทำนายนี้เป็นข้อคิดเท่านั้น' : '') + ' ไพ่เป็นแนวทางให้ลูกคิด ไม่ใช่คำตัดสินชะตา ตัดสินใจด้วยตัวเองเสมอนะ';
      await say({ th: end, ko: TONE[tone].ko + ' 카드는 길잡이일 뿐, 선택은 네 몫이란다.', ja: TONE[tone].ja + ' カードは道しるべ。決めるのはあなたです。', zh: TONE[tone].zh + ' 牌只是指引，决定权在你。' }); ck();
      var again = await choose([{ h: '🔁 ดูอีกครั้ง', s: 'เลือกโต๊ะใหม่' }, { h: '✕ ปิด', s: 'ออกจากห้องดูดวง' }]); ck();
      if (again === 0) run(); else close();
    } catch (e) { if (e !== 0) console.error(e); }
  }

  window.SSTarot = { open: open, close: close };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
