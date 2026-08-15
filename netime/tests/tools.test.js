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
