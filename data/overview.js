/* 导论页「两千年一览」的内容。
   每课的代表事件不写在这里，而是在各课 events 里标 milestone: true，这样改事件时概览自动同步。 */
window.COURSE_OVERVIEW = {
  title: '两千年一览',
  subtitle: '十三课，十三个转折点',
  lede: '开课之前，先把整条路看一遍：每一课挑一件最能代表它的大事，按五个时代排开。上面的横条是真实比例——前五课走过一千五百年，后八课只走了不到五百年。',
  eras: [
    { id: 'early', name: '早期教会', years: '30–451', lessons: [1, 2, 3], note: '在逼迫中扩展，在争论中确立正统。' },
    { id: 'medieval', name: '中世纪', years: '451–1500', lessons: [4, 5], note: '东西方分道扬镳，教皇权力登上顶峰，改革的先驱出现。' },
    { id: 'reformation', name: '宗教改革', years: '1500–1603', lessons: [6, 7, 8], note: '重新发现因信称义的福音，从维滕堡、苏黎世、日内瓦到英格兰。' },
    { id: 'puritans-america', name: '清教徒与美洲', years: '1600–1850', lessons: [9, 10, 11], note: '清教徒渡海建“山上之城”，两次大觉醒改变了美国的教会。' },
    { id: 'modern', name: '宣教与现代', years: '1792–今', lessons: [12, 13], note: '浸信会与现代宣教运动，二十世纪的神学争战与地方教会。' }
  ],
  meta: {}
};
