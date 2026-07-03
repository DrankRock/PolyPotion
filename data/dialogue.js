// Dialogue graph for Mat.ai.
//
// Persona: the host is a quiet, all-knowing presence — a keeper, a librarian
// of his own life. He speaks plainly, like a person, not a quest-giver.
// No numbers, no game-y phrasing.
//
// Each node has:
//   line       — what the host says
//   audio      — optional pre-recorded audio path
//   animation  — optional clip name on the .glb
//   scene      — visual the BACKGROUND should show while this line is spoken
//                { image: "img/x.jpg", caption?: "subtle label" }
//                The image is a still that fades in like a slide; you can swap
//                placeholders for real photos later.
//   choices    — visitor's possible replies, each pointing to another node.
//
// Replace the placeholder copy with real CV later. The story is invented;
// it gives the host a coherent voice to talk in until you record real audio.

window.DIALOGUE = {
  start: "root",
  nodes: {

    root: {
      line: "You're here. Good. Come closer — there's no need to stand at the edge of the room. I keep this place lit for whoever wanders in. Ask me anything you like; I have time.",
      audio: "audio/root.mp3",
      animation: "Greet",
      scene: { image: "img/01_threshold.jpg", caption: "the threshold" },
      choices: [
        { label: "Who are you?",                target: "who" },
        { label: "What is this place?",          target: "place" },
        { label: "What have you done with your life?", target: "work" },
        { label: "What are you doing now?",      target: "now" },
      ],
    },

    who: {
      line: "A keeper, mostly. I was given a name like anyone else — Mathieu — but the work has always been the same: pay attention to things, then take care of them. I grew up between two towns and never quite chose one, which I think is why I ended up here, where the door is always open.",
      audio: "audio/who.mp3",
      animation: "Speak_Calm",
      scene: { image: "img/02_two_towns.jpg", caption: "between two towns" },
      choices: [
        { label: "How did you start?",       target: "origin" },
        { label: "What did you study?",      target: "study" },
        { label: "What have you done?",      target: "work" },
        { label: "(go back)",                target: "root" },
      ],
    },

    origin: {
      line: "I was the kind of child who took the radio apart and the kind of teenager who wrote letters by hand. Both of those still feel useful — you take a thing apart to understand it, you write it down to keep it. Most of what I do is one or the other.",
      audio: "audio/origin.mp3",
      animation: "Speak_Reflect",
      scene: { image: "img/03_radio_letters.jpg", caption: "taking things apart" },
      choices: [
        { label: "What did you study?",       target: "study" },
        { label: "Where did that lead?",      target: "work" },
        { label: "(go back)",                 target: "who" },
      ],
    },

    study: {
      line: "I read more than I sat in classrooms, but I sat in enough of them. Engineering on paper; design in practice. The two arguments I had with my teachers were the ones I learned the most from — one about what's beautiful, one about what's worth building. I think I'm still answering both.",
      audio: "audio/study.mp3",
      animation: "Speak_Thoughtful",
      scene: { image: "img/04_library.jpg", caption: "the long study" },
      choices: [
        { label: "And after that?",       target: "work" },
        { label: "What do you care about?", target: "care" },
        { label: "(go back)",             target: "who" },
      ],
    },

    place: {
      line: "This is the room I built to host the conversation I never get to have at parties. People walk in, ask the things they actually want to ask, and leave with the answer instead of a half-answer over a drink. The walls change with whatever I'm telling you about. Don't worry about it.",
      audio: "audio/place.mp3",
      animation: "Speak_Warm",
      scene: { image: "img/05_room.jpg", caption: "the host's room" },
      choices: [
        { label: "Who comes here?",      target: "visitors" },
        { label: "Why do you keep it?",  target: "care" },
        { label: "(go back)",            target: "root" },
      ],
    },

    visitors: {
      line: "Recruiters. Old colleagues. Strangers a friend told to look me up. Someone's father, once, who wanted to know if I'd take care of his daughter's first job. Most leave with what they came for. A few stay longer and we end up talking about something else entirely.",
      audio: "audio/visitors.mp3",
      animation: "Speak_Amused",
      scene: { image: "img/06_visitors.jpg", caption: "those who come" },
      choices: [
        { label: "What do they usually ask?", target: "work" },
        { label: "(go back)",                 target: "place" },
      ],
    },

    work: {
      line: "Three things I'd actually want to talk about. I built a tool that quietly runs in a few thousand pockets now — the kind of thing you forget is there, which was the point. I led a team through a year nobody enjoyed and we came out the other side still speaking to each other. And I made a small, strange object that wasn't a job but it taught me more than the jobs did.",
      audio: "audio/work.mp3",
      animation: "Speak_Confident",
      scene: { image: "img/07_three_things.jpg", caption: "three things worth telling" },
      choices: [
        { label: "Tell me about the tool.",     target: "work_tool" },
        { label: "Tell me about the team.",     target: "work_team" },
        { label: "Tell me about the strange object.", target: "work_object" },
        { label: "(go back)",                   target: "root" },
      ],
    },

    work_tool: {
      line: "It started because I was annoyed. I wanted a thing that did one job, well, without asking me anything. Most software asks you too much. So I made the small version, gave it to friends, watched what they did with it, took out half of what I'd built. Then half of that. What's left is what people use.",
      audio: "audio/work_tool.mp3",
      animation: "Speak_Story",
      scene: { image: "img/08_tool.jpg", caption: "the small useful thing" },
      choices: [
        { label: "What did you take out?",     target: "lessons" },
        { label: "What about the team year?",  target: "work_team" },
        { label: "(go back)",                  target: "work" },
      ],
    },

    work_team: {
      line: "Six people, a deadline that moved twice, a problem none of us had solved before. I learned that the work of leading isn't deciding — it's being the person who keeps remembering, out loud, what we're actually doing. We shipped late and it didn't matter. The thing was right.",
      audio: "audio/work_team.mp3",
      animation: "Speak_Earnest",
      scene: { image: "img/09_team.jpg", caption: "six and a deadline" },
      choices: [
        { label: "What did you keep from it?", target: "lessons" },
        { label: "What about the strange object?", target: "work_object" },
        { label: "(go back)",                  target: "work" },
      ],
    },

    work_object: {
      line: "A book, almost. A device that wasn't meant to be sold. I made it during a slow autumn, partly to figure out something I couldn't think my way through. It's in a drawer now. It taught me that if I can't make a thing with my hands, I probably don't understand it yet.",
      audio: "audio/work_object.mp3",
      animation: "Speak_Quiet",
      scene: { image: "img/10_object.jpg", caption: "the slow autumn" },
      choices: [
        { label: "What did it teach you?", target: "lessons" },
        { label: "What are you on now?",   target: "now" },
        { label: "(go back)",              target: "work" },
      ],
    },

    lessons: {
      line: "Cut the thing in half. Then in half again. Whatever survives is what mattered. That's true for code, for furniture, for a paragraph, for a conversation. People remember what was left out as much as what was kept.",
      audio: "audio/lessons.mp3",
      animation: "Speak_Slow",
      scene: { image: "img/11_lessons.jpg", caption: "what's left when you stop" },
      choices: [
        { label: "What are you doing now?", target: "now" },
        { label: "What do you want next?",  target: "ahead" },
        { label: "(go back)",               target: "root" },
      ],
    },

    now: {
      line: "This, partly — the room you're in. I'm building something I don't have a clean name for: a way for a person to be a place you can visit, instead of a profile you can scroll. I don't think the résumé survives the next ten years. I'd rather be early than tidy.",
      audio: "audio/now.mp3",
      animation: "Speak_Present",
      scene: { image: "img/12_now.jpg", caption: "what I'm building" },
      choices: [
        { label: "What do you need?",    target: "asks" },
        { label: "What comes after?",    target: "ahead" },
        { label: "(go back)",            target: "root" },
      ],
    },

    ahead: {
      line: "I want to keep working with people who are quietly serious. I want to make one more thing that stays useful for ten years. I want to learn something I can't yet name. That's the order, more or less.",
      audio: "audio/ahead.mp3",
      animation: "Speak_Steady",
      scene: { image: "img/13_ahead.jpg", caption: "the order, more or less" },
      choices: [
        { label: "What do you need from me?", target: "asks" },
        { label: "How do I find you?",        target: "contact" },
        { label: "(go back)",                 target: "root" },
      ],
    },

    care: {
      line: "Care is the whole job, in the end. You build something carefully, you ship it carefully, you hand it over carefully, you let it go. People can tell. They can always tell.",
      audio: "audio/care.mp3",
      animation: "Speak_Soft",
      scene: { image: "img/14_care.jpg", caption: "the whole job" },
      choices: [
        { label: "What are you on now?", target: "now" },
        { label: "(go back)",            target: "root" },
      ],
    },

    asks: {
      line: "Three things, if you're offering. An introduction to anyone running a small, careful team. A little time on a problem I'll send you, if it sounds like yours. And honest feedback on this — the room, the way I'm telling it. I'd rather hear it from you than figure it out alone.",
      audio: "audio/asks.mp3",
      animation: "Speak_Open",
      scene: { image: "img/15_asks.jpg", caption: "what would help" },
      choices: [
        { label: "How do I find you?", target: "contact" },
        { label: "(go back)",          target: "now" },
      ],
    },

    contact: {
      line: "Write to me. The address is on the door as you leave — I'll see it. I answer slowly but I answer. If you'd rather come back here, the room will be the same, give or take the weather. Until then.",
      audio: "audio/contact.mp3",
      animation: "Speak_Close",
      scene: { image: "img/16_door.jpg", caption: "the door" },
      choices: [
        { label: "Until then.",          target: "farewell" },
        { label: "Actually — one more thing.", target: "root" },
      ],
    },

    farewell: {
      line: "Travel well. The lamp stays on.",
      audio: "audio/farewell.mp3",
      animation: "Wave",
      scene: { image: "img/17_lamp.jpg", caption: "the lamp" },
      end: true,
      choices: [
        { label: "(begin again)", target: "root" },
      ],
    },
  },
};

// Characters. Default is the host.
window.CHARACTERS = [
  {
    id: "self",
    name: "Mathieu",
    title: "the host",
    model: "models/self.glb",
    scale: 1.0,
    offsetY: 0.0,
  },
  {
    id: "self_alt",
    name: "Mathieu, younger",
    title: "another self",
    model: "models/self_alt.glb",
    scale: 1.0,
    offsetY: 0.0,
    locked: true,
  },
  {
    id: "guide",
    name: "The keeper",
    title: "a guest",
    model: "models/guide.glb",
    scale: 1.0,
    offsetY: 0.0,
    locked: true,
  },
];

// Environments — these are AMBIENT settings (the room itself).
// Per-line scene images (above) are layered ON TOP and change with each line.
window.ENVIRONMENTS = [
  { id: "room",        name: "The room",     ambient: "#2a221b", accent: "#d4a373" },
  { id: "garden",      name: "The garden",   ambient: "#1f2a23", accent: "#a8b89a" },
  { id: "library",     name: "The library",  ambient: "#26201a", accent: "#c9a87a" },
  { id: "observatory", name: "The dark",     ambient: "#0a0a0e", accent: "#7a8aa8" },
  { id: "workshop",    name: "The workshop", ambient: "#1a1612", accent: "#d48a4a" },
  { id: "tavern",      name: "The hearth",   ambient: "#2a1a10", accent: "#e8a85a" },
  { id: "shore",       name: "The shore",    ambient: "#1a2530", accent: "#88b0c8" },
];
