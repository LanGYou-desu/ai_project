'use strict';
const T = global.NetTools;

test('ROT13：已知密文解码', function () {
  const dec = T.rot13('Gur svefg xrl vf: JNAT. V jvyy or jnvgvat va gur cynpr jurer gur fvtany yvirf.');
  assertEq(dec, 'The first key is: WANG. I will be waiting in the place where the signal lives.');
});

test('ROT13：往返一致', function () {
  const s = 'Hello NETIME 网络时光机 2025';
  assertEq(T.rot13(T.rot13(s)), s);
});

test('Base64：UTF-8 中文往返', function () {
  const s = '网络之声永存';
  assertEq(T.b64decodeUtf8(T.b64encodeUtf8(s)), s);
});

test('Base64：oblivion_keeper 签名解码', function () {
  assertEq(T.b64decodeUtf8('b2JsaXZpb25fa2VlcGVy'), 'oblivion_keeper');
});

test('Base64：已知向量（ASCII）', function () {
  assertEq(T.b64encodeUtf8('Hello, World!'), 'SGVsbG8sIFdvcmxkIQ==');
  assertEq(T.b64decodeUtf8('SGVsbG8sIFdvcmxkIQ=='), 'Hello, World!');
});

test('摩斯：YOU SHOULD GO TO RADIO 编码', function () {
  assertEq(T.morseEncode('YOU SHOULD GO TO RADIO'),
    '-.-- --- ..- / ... .... --- ..- .-.. -.. / --. --- / - --- / .-. .- -.. .. ---');
});

test('摩斯：源代码注释中的密文解码', function () {
  const dec = T.morseDecode('-.-- --- ..- / ... .... --- ..- .-.. -.. / --. --- / - --- / .-. .- -.. .. ---');
  assertEq(dec, 'YOU SHOULD GO TO RADIO');
});

test('摩斯：编码-解码往返', function () {
  const s = 'GOODBYE NETWORK';
  assertEq(T.morseDecode(T.morseEncode(s)), s);
});

test('摩斯：单字母与标点', function () {
  assertEq(T.morseEncode('SOS'), '... --- ...');
  assertEq(T.morseDecode('... --- ...'), 'SOS');
});

test('藏头检测：博客六段首字', function () {
  const text = [
    '钥匙这个东西，最怕的就是被遗忘。',
    '匙子能打开锁，而文字能打开记忆。',
    '在互联网上，一切都不会真正消失。',
    '第一台服务器，第一行代码，第一个网友。',
    '三年前我搬了一次家。',
    '条条大路通罗马。'
  ].join('\n');
  assertEq(T.firstCharsOfLines(text), '钥匙在第三条');
});

test('字符统计：频次排序', function () {
  const f = T.charFreq('abracadabra');
  assertEq(f[0].char, 'a');
  assertEq(f[0].count, 5);
});

/* ---------- 健壮性：非法 / 变体输入 ---------- */

test('ROT13：非字母、全角与非字符串原样处理', function () {
  assertEq(T.rot13('Ｈｅｌｌｏ 123 —— 网络'), 'Ｈｅｌｌｏ 123 —— 网络');
  assertEq(T.rot13(12345), '12345');
  assertEq(T.rot13('Ünïcode'), 'Üaïpbqr');
});

test('Base64：非法输入抛错而不是静默乱码', function () {
  assertThrows(function () { T.b64decodeUtf8('!!!not base64!!!'); }, '含非法字符应抛错');
  assertThrows(function () { T.b64decodeUtf8('SGVsbG8=extra'); }, '中间出现 = 应抛错');
  assertThrows(function () { T.b64decodeUtf8('A'); }, '长度 %4==1 应抛错');
});

test('Base64：容忍空白、换行与 URL-safe 字符', function () {
  assertEq(T.b64decodeUtf8('SGVs bG8s\nIFdvcmxk IQ=='), 'Hello, World!');
  assertEq(T.b64decodeUtf8('b2JsaXZpb25fa2VlcGVy'), 'oblivion_keeper');
  assertEq(T.b64decodeUtf8(''), '');
  assertEq(T.b64decodeUtf8(null), '');
  // 编码-解码往返在随机长度下也成立（覆盖填充的 0/1/2 字节尾巴）
  for (let n = 0; n < 64; n++) {
    let s = '';
    for (let i = 0; i < n; i++) s += String.fromCharCode(32 + ((n * 7 + i * 13) % 90));
    assertEq(T.b64decodeUtf8(T.b64encodeUtf8(s)), s, '长度 ' + n + ' 的往返');
  }
});

test('Base64：TextEncoder 不可用时的回退也支持 Unicode 与表情', function () {
  const prevEnc = global.TextEncoder, prevDec = global.TextDecoder;
  global.TextEncoder = undefined;
  global.TextDecoder = undefined;
  try {
    const s = '网络 🎉 ä';
    assertEq(T.b64encodeUtf8(s), '572R57ucIPCfjokgw6Q=', '回退编码应与标准一致');
    assertEq(T.b64decodeUtf8(T.b64encodeUtf8(s)), s, '回退解码应还原原字符串');
  } finally {
    global.TextEncoder = prevEnc;
    global.TextDecoder = prevDec;
  }
});

test('摩斯：词分隔符支持 "/"、"|" 与多个空格', function () {
  assertEq(T.morseDecode('-.-- --- ..- / ... .... --- ..- .-.. -..'), 'YOU SHOULD');
  assertEq(T.morseDecode('-.-- --- ..-   ... .... --- ..- .-.. -..'), 'YOU SHOULD');
  assertEq(T.morseDecode('-.-- --- ..- | --. ---'), 'YOU GO');
  assertEq(T.morseDecode('-.--/---'), 'YO', '紧贴字母的 / 视为字母分隔');
  assertEq(T.morseDecode('-.--\n--- ..-'), 'YOU');
  assertEq(T.morseDecode(''), '');
  assertEq(T.morseDecode('   '), '');
});

test('摩斯：未知点划组合输出 ?', function () {
  assertEq(T.morseDecode('....-...'), '?');
  assertEq(T.morseDecode('... --- ... ....-...'), 'SOS?');
});

test('摩斯编码：多个空格归一为单个词分隔', function () {
  assertEq(T.morseEncode('A  B'), '.- / -...');
  assertEq(T.morseEncode('A\nB'), '.- / -...');
  assertEq(T.morseEncode('  SOS  '), '... --- ...');
  assertEq(T.morseDecode(T.morseEncode('网络')), '网络', '非拉丁字符原样往返');
});

test('字符统计：标点、表情与扩展区汉字都计入（按码点）', function () {
  const f = T.charFreq('🎉🎉x，a');
  assertEq(f[0].char, '🎉');
  assertEq(f[0].count, 2);
  assert(f.some(function (x) { return x.char === '，'; }), '中文标点应计入');
  assert(T.charFreq('\u{20BB7}').length === 1, '扩展区汉字应计入');
  assertEq(T.charFreq('').length, 0);
  assertEq(T.charFreq('   \n\t ').length, 0);
});

test('藏头检测：兼容 CRLF 与空行', function () {
  assertEq(T.firstCharsOfLines('钥匙\r\n匙子\r\n\r\n在网'), '钥匙在');
  assertEq(T.firstCharsOfLines(''), '');
});
