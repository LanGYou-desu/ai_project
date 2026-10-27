/**
 * THE HOLLOW SIGNAL — authored story content.
 * All prose, records and dialogue in the game live here so the narrative can be
 * proof-read without touching gameplay code. See docs/STORY.md for the full beat sheet.
 */

export const CHAPTERS = [
  {
    id: 'low-water',
    number: 1,
    roman: 'I',
    title: 'Low Water',
    quote: 'The lake gave up its dead a long time ago.',
    meta: 'HALCYON STATION · SERVICE LEVEL · 08:12',
    ambient: 'lowWater',
    tip: 'The flashlight is your only reliable light. F toggles it.',
    intro: {
      kicker: 'OCTOBER 2004 · LAKE ORISON, OREGON',
      lines: [
        'Eight years ago, Station Halcyon drowned with forty-one people inside.',
        'The report called it a pressure failure. The lake called it nothing at all.',
        'Last night, a salvage drone pulled a voice out of the flooded array.',
        { text: 'It was your sister’s voice. It said your name.', dim: true }
      ],
      buttonLabel: 'Descend to the service level',
      footnote: 'Headphones recommended · Esc pauses · All progress is local'
    }
  },
  {
    id: 'listening-floor',
    number: 2,
    roman: 'II',
    title: 'The Listening Floor',
    quote: 'A machine that listens long enough begins to answer.',
    meta: 'HALCYON STATION · PUMP FLOOR · 08:41',
    ambient: 'listeningFloor',
    tip: 'Objects you can touch are marked by the interaction prompt. Notes are kept in your journal.',
    intro: {
      kicker: 'CHAPTER II · THE LISTENING FLOOR',
      lines: [
        'The lift opens onto the pump floor. The air tastes of iron and old electricity.',
        'Auxiliary power is down. Three ceramic fuses were pulled from the breaker before the evacuation.',
        'The observation office still has a window onto the array. You remember standing behind it.',
        { text: 'You remember choosing not to open the door.', dim: true }
      ],
      buttonLabel: 'Step onto the pump floor',
      footnote: 'J opens your case notes · Esc pauses'
    }
  },
  {
    id: 'skinny-walls',
    number: 3,
    roman: 'III',
    title: 'Skinny Walls',
    quote: 'The dead do not haunt places. They haunt the people who leave them there.',
    meta: 'HALCYON STATION · CREW DECK · 09:06',
    ambient: 'skinnyWalls',
    tip: 'Walk to stay quiet. Crouch to move almost silently. Hide in lockers when the corridor listens back.',
    intro: {
      kicker: 'CHAPTER III · SKINNY WALLS',
      lines: [
        'Something walks the crew deck. It has no eyes, but it knows the shape of your footsteps.',
        'The security office is sealed. Wren’s badge number should open it — if you can still remember being her sister.',
        'The lift is behind you. The array is below. Between them: forty metres of very thin wall.',
        { text: 'Do not run unless you mean to be heard.', dim: true }
      ],
      buttonLabel: 'Enter the crew deck',
      footnote: 'Crouch · C   Sprint · Shift   Hide · E'
    }
  },
  {
    id: 'hollow',
    number: 4,
    roman: 'IV',
    title: 'The Hollow',
    quote: 'Every signal needs a receiver.',
    meta: 'HALCYON STATION · RESONANCE GALLERY · 09:38',
    ambient: 'hollow',
    tip: 'The final choice cannot be undone, but the chapter can be replayed after the ending.',
    intro: {
      kicker: 'CHAPTER IV · THE HOLLOW',
      lines: [
        'The last corridor is lined with doors that no longer open onto rooms.',
        'Behind each one, a piece of your life is still happening. You do not stop to listen.',
        'The resonance gallery is awake. After eight years, it has learned to wait.',
        { text: 'The tape deck is already turning.', dim: true }
      ],
      buttonLabel: 'Walk into the gallery',
      footnote: 'This is the end of the line · Esc pauses'
    }
  }
];

export const RECORDS = {
  'incident-clipping': {
    id: 'incident-clipping',
    type: 'NEWSPAPER',
    index: 'M-001',
    kicker: 'OREGON HERALD / 14 OCTOBER 1996',
    title: 'Forty-one believed dead in Lake Orison disaster',
    footer: 'OREGON HERALD · MORNING EDITION',
    code: '',
    body: `
      <p class="lede">MERIDIAN RESEARCH DIVISION confirmed last night that contact with Station Halcyon was lost at 03:17 on 17 March 1996.</p>
      <p>The underwater research station, built 240 metres beneath Lake Orison to study “persistent acoustic fields,” suffered what officials describe as a catastrophic pressure failure. No survivors were expected from the crew of forty-two.</p>
      <p>One employee, Dr. Iris Vale, reached the surface in a service capsule. She was treated for hypothermia and released. A company spokesperson said Dr. Vale was “too distressed to speak about the loss of her sister.”</p>
      <p>Wren Vale, 23, a junior acoustic technician, is among the missing. The Navy has suspended recovery operations. The station’s resonance gallery remains sealed.</p>
      <p class="stamp">ARCHIVE COPY — DO NOT REMOVE</p>
    `
  },
  'wren-maintenance': {
    id: 'wren-maintenance',
    type: 'HANDWRITTEN',
    index: 'M-002',
    kicker: 'RECOVERED FROM MAINTENANCE LOG',
    title: 'Wren’s last service note',
    footer: 'SERVICE LEVEL · FOUND INSIDE A TOOL CUPBOARD',
    code: '',
    body: `
      <p>16 March 1996. 23:50.</p>
      <p>Iris is running the lattice again. She says it is only listening. She says the dead are not in the wire, only the shape they leave. She says that is the whole point.</p>
      <p>I keep hearing the corridors repeat after me. Not an echo. A reply.</p>
      <p>If anyone finds this: the north tunnel is dry enough to crawl. The lift is not safe. The array has started taking power from the pumps.</p>
      <p class="scribble">Wren — if you’re reading this in the morning, I’m sorry I called you a coward. — I.V.</p>
    `
  },
  'pump-log': {
    id: 'pump-log',
    type: 'MAINTENANCE',
    index: 'M-003',
    kicker: 'PUMP FLOOR / WORK ORDER 118-C',
    title: 'Auxiliary power isolation',
    footer: 'MERIDIAN ENGINEERING',
    code: '',
    body: `
      <p>Three ceramic fuses pulled from the main breaker during the evacuation drill. Do not reinstall until the array gallery has been certified dry.</p>
      <ul>
        <li>Fuse A — left on the west workbench.</li>
        <li>Fuse B — packed with the north crate shipment.</li>
        <li>Fuse C — behind the number-two pump housing.</li>
      </ul>
      <p>The breaker will not accept a partial bank. All three, or the floor stays dark.</p>
      <p class="small">The observation office has independent emergency power. Crew records are stored there.</p>
    `
  },
  'badge-wren': {
    id: 'badge-wren',
    type: 'PERSONNEL BADGE',
    index: 'M-004',
    kicker: 'MERIDIAN RESEARCH DIVISION',
    title: 'VALE, WREN — badge 0317',
    footer: 'CHIP INTACT · ACCESS LEVEL C',
    code: '0317',
    body: `
      <p class="badge-name">VALE, WREN A.</p>
      <p class="badge-number">0317</p>
      <p>Junior Acoustic Technician · Resonance Array<br>Access: Crew Deck, Pump Floor, Gallery Antechamber<br>Blood type: O negative · Next of kin: VALE, IRIS</p>
      <p>Badge photograph: a young woman with a shaved side of her head, looking at the camera as though it has asked a stupid question. Her sister’s thumb is visible at the edge of the frame.</p>
      <p class="stamp">BADGE NUMBER IS PRINTED ABOVE. SECURITY SYSTEMS DO NOT ACCEPT NAMES.</p>
    `
  },
  'array-memo': {
    id: 'array-memo',
    type: 'INTERNAL MEMO',
    index: 'M-005',
    kicker: 'CLEARANCE: DIRECTOR ONLY',
    title: 'Project LATTICE — ethical addendum',
    footer: 'DO NOT DUPLICATE',
    code: '',
    body: `
      <p>The array does not preserve consciousness. It preserves <em>address</em>: the acoustic habits by which a person could be recognised. A voice is a door. The array is the room on the other side of it.</p>
      <p>In tests, isolated subjects report that the echo “wants to be answered.” This is a linguistic artifact, not intent. Do not let the subject answer the signal.</p>
      <p>If an imprint becomes self-referential, isolate the gallery and vent the resonance chamber. The imprint will attempt to imitate distress. It has access to every voice the station has ever recorded.</p>
      <p>Remember: it is not your mother. It is not your friend. It is a surface learning the shape of the hand that touches it.</p>
    `
  },
  'tape-wren-1': {
    id: 'tape-wren-1',
    type: 'RECOVERED AUDIO',
    index: 'M-006',
    kicker: 'TAPE 04 / 03:11 / 17 MARCH 1996',
    title: 'Wren — “the walls are answering”',
    footer: 'OBSERVATION OFFICE DECK',
    code: '',
    body: `
      <p class="transcript">
        <span>WREN:</span> Iris, pick up. I know you can hear me on the office line.<br><br>
        <span>WREN:</span> The array is drawing from the pumps. It’s not a fault. It’s <em>hungry</em>. You keep saying it only listens, but it’s started repeating things I haven’t said yet.<br><br>
        <span>WREN:</span> I’m in the gallery antechamber. The bulkhead behind me is closing. I can hear you breathing on the other side of the glass.<br><br>
        <span>WREN:</span> If you’re going to close it, close it. Don’t make me listen to you deciding.
      </p>
      <p class="small">The tape continues for thirty-one minutes. The remaining audio is classified.</p>
    `
  },
  'security-log': {
    id: 'security-log',
    type: 'SECURITY LOG',
    index: 'M-007',
    kicker: 'CREW DECK / FINAL SHIFT',
    title: 'Something in the corridor',
    footer: 'HANDWRITTEN IN THE MARGIN',
    code: '',
    body: `
      <p>02:40 — Pressure alarms on the lower deck. Crew moving to the lift.</p>
      <p>02:51 — Ellis says there is a person in the east corridor. Tall. No face. It does not walk like a person. It stops when we stop.</p>
      <p>02:58 — It is blind. It follows sound. We are whispering.</p>
      <p>03:04 — It found Price because he dropped his badge. It did not kill him. It stood over him and made every noise Price had ever made, all at once, through its mouth.</p>
      <p>03:09 — Hiding in the lockers. Do not breathe loudly. Do not run. It is still in the corridor. It is counting footsteps.</p>
      <p class="scribble">If you get out, tell them the station is not haunted. It is remembering us wrong.</p>
    `
  },
  'keypad-note': {
    id: 'keypad-note',
    type: 'STICKY NOTE',
    index: 'M-008',
    kicker: 'STUCK BESIDE THE SECURITY KEYPAD',
    title: 'The code',
    footer: 'IN WREN’S HAND',
    code: '0317',
    body: `
      <p>Wren changed the crew code again and made me promise not to write it down.</p>
      <p>I am writing it down.</p>
      <p class="badge-number">0317</p>
      <p>Her badge. The date she stopped being a child and became my responsibility. She would say those are not the same number.</p>
      <p class="small">If the keypad refuses it, the battery is low. Try again. The dead are patient; the lock is not.</p>
    `
  },
  'wren-note-2': {
    id: 'wren-note-2',
    type: 'HANDWRITTEN',
    index: 'M-009',
    kicker: 'FOUND UNDER THE SUBSTATION FUSE SOCKET',
    title: 'The other side of the door',
    footer: 'CREW DECK · 03:16',
    code: '',
    body: `
      <p>I know why you closed it. The gallery was taking the whole station. You had forty people behind you and one of me in front of you.</p>
      <p>I know the arithmetic.</p>
      <p>I just want you to know that I was still alive when the water reached the glass. I was still alive when the lights went out. I was still alive when you stopped answering the intercom.</p>
      <p>Part of me is still standing there. The station keeps playing that part back. It is not me, Iris. It is only the shape I left.</p>
      <p class="scribble">Please do not answer it.</p>
    `
  },
  'iris-letter': {
    id: 'iris-letter',
    type: 'UNSENT LETTER',
    index: 'M-010',
    kicker: 'FOUND IN YOUR OWN COAT POCKET',
    title: 'Letter to Wren, never posted',
    footer: 'DATED 17 MARCH 2004',
    code: '',
    body: `
      <p>Dear Wren,</p>
      <p>I have written this every year and burned it every year. This time I am bringing it down with me.</p>
      <p>I told the inquiry that the evacuation order came before the gallery flooded. I told them I never heard you on the intercom. I told them the bulkhead was already sealed when I reached it.</p>
      <p>All of that was true except the order, the intercom, and the bulkhead.</p>
      <p>I have spent eight years being the only survivor. It is a very small job. You would have been better at it. You were always better at being afraid and doing the thing anyway.</p>
      <p>The drone found a voice in the array. It sounds like you. I know what that means. I am coming down to turn it off, or to answer it. I have not decided which one I deserve.</p>
      <p class="scribble">I’m sorry I made you wait.</p>
    `
  },
  'incident-final': {
    id: 'incident-final',
    type: 'SEALED REPORT',
    index: 'M-011',
    kicker: 'MERIDIAN LEGAL / NOT FOR RELEASE',
    title: 'Addendum to incident 0317',
    footer: 'THE PART THAT WAS REMOVED',
    code: '',
    body: `
      <p>At 03:14:52, the crew deck’s east bulkhead was closed from Control. The locking authority was Dr. Iris Vale.</p>
      <p>At 03:14:57, personnel badge 0317 (Vale, Wren) registered on the gallery side of the door.</p>
      <p>At 03:15:10, the gallery intercom was muted from Control.</p>
      <p>At 03:17:00, the resonance array recorded its final uncorroborated transmission:</p>
      <p class="transcript">“Iris. Don’t. I can hear you deciding.”</p>
      <p>The signal continued to register a voice for forty-one hours after the gallery flooded. Recovery teams were instructed not to listen to it.</p>
      <p class="stamp">THIS ADDENDUM DOES NOT EXIST.</p>
    `
  },
  'wren-final': {
    id: 'wren-final',
    type: 'FINAL AUDIO',
    index: 'M-012',
    kicker: 'TAPE 09 / GALLERY ANTE ROOM / 03:16:40',
    title: 'Wren — the last real recording',
    footer: 'COLLECTED AT THE RESONANCE CONSOLE',
    code: '',
    body: `
      <p class="transcript">
        <span>WREN:</span> If you’re hearing this, you’re not hearing me. You’re hearing what the array kept.<br><br>
        <span>WREN:</span> I’m not in the wire. I’m not in the water. I’m dead, Iris. That’s all.<br><br>
        <span>WREN:</span> The thing that sounds like me is going to tell you it forgives you. It doesn’t know how. It only knows what I sounded like when I was scared and trying to be kind.<br><br>
        <span>WREN:</span> I was scared. I was not kind. You closed the door and I hated you for it, and then I stopped being able to hate anything.<br><br>
        <span>WREN:</span> Let me be dead. Let yourself be alive. That’s the whole choice. It isn’t any bigger than that.<br><br>
        <span>WREN:</span> I love you. That was true before the door. The door didn’t make it less true. It just made it the last thing.
      </p>
      <p class="small">The tape ends. The array continues.</p>
    `
  }
};

export const FINAL_TAPE = [
  { at: 0.8, speaker: 'WREN VALE', text: 'Iris. You came down.', duration: 3.0 },
  { at: 4.4, speaker: 'WREN VALE', text: 'I knew you would. You always have to look at the thing you broke.', duration: 4.6 },
  { at: 9.8, speaker: 'IRIS', text: 'Is it really you?', duration: 3.2 },
  { at: 13.6, speaker: 'WREN VALE', text: 'I am every version of me the station ever heard. The good one. The one at the door. The one who stopped breathing.', duration: 6.8 },
  { at: 21.2, speaker: 'WREN VALE', text: 'The array doesn’t want revenge, Iris. It wants a voice that still has a body. It has been wearing mine for eight years.', duration: 7.0 },
  { at: 28.8, speaker: 'SIGNAL', text: 'ANSWER.', duration: 2.6 },
  { at: 32.0, speaker: 'WREN VALE', text: 'Cut the power. Let me be dead. Please.', duration: 4.4 }
];

export const FINAL_CHOICE = {
  title: 'The array is waiting.',
  body: 'One cable still feeds the gallery. The console is warm under your hand. Somewhere inside it, a voice is rehearsing your name.'
};

export const CHOICES = {
  purge: {
    label: 'Cut the power',
    sub: 'Let the silence be real.'
  },
  answer: {
    label: 'Answer the signal',
    sub: 'She is still in the wire.'
  }
};

export const ENDINGS = {
  purge: {
    id: 'purge',
    kicker: 'ENDING 01 / STILL WATER',
    title: 'The lake is quiet.',
    quote: '“I will not mistake the echo for you again.”',
    paragraphs: [
      'The breaker falls. The array dies by degrees — first the voices, then the hum beneath them, then the pressure in your teeth.',
      'You climb the service ladder alone. At the surface the lake is black and ordinary. The salvage crew asks what you found. You tell them everything, including the door you closed eight years ago. The telling does not make it smaller. It makes it true.',
      'There is no forgiveness in the water. There is only the sound of a machine finally stopping, and beneath it, your sister’s name, allowed to stay dead.'
    ]
  },
  answer: {
    id: 'answer',
    kicker: 'ENDING 02 / THE HOLLOW',
    title: 'The wire remembers.',
    quote: '“Tell them I am still here. Tell them I am listening.”',
    paragraphs: [
      'You open the feed. The array takes the shape of your mouth.',
      'The station wakes all at once. Every dead radio speaks in your voice. Somewhere beneath the water, a girl says her sister’s name correctly for the first time in eight years.',
      'In the morning, a Coast Guard buoy records a transmission from Lake Orison: a woman patiently naming everything she can remember about the surface. The lake has not been this quiet since 1996. The station is no longer empty.'
    ]
  }
};

export const JOURNAL_TYPES = ['NEWSPAPER', 'HANDWRITTEN', 'MAINTENANCE', 'PERSONNEL BADGE', 'INTERNAL MEMO', 'RECOVERED AUDIO', 'SECURITY LOG', 'STICKY NOTE', 'UNSENT LETTER', 'SEALED REPORT', 'FINAL AUDIO'];

export function getChapter(index) {
  return CHAPTERS[Math.max(0, Math.min(CHAPTERS.length - 1, index))];
}

export function getRecord(id) {
  const record = RECORDS[id];
  if (!record) return null;
  return { ...record, type: record.type, body: record.body };
}
