import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from './firebase';

type ThemeKey = 'minecraft' | 'pinkRabbit' | 'snowPrincess' | 'spongeSea';
type LangKey = 'en' | 'th';
type TabKey = 'learn' | 'score' | 'shop' | 'profile';
type AuthMode = 'login' | 'register';

interface WordItem {
  id: string;
  text: string;
  lang: LangKey;
}

interface UserProfile {
  name: string;
  className: string;
  coins: number;
  theme: ThemeKey;
  avatarUrl: string;
  completedWords: string[];
  claimedRewardIds: string[];
  email: string;
}

interface PublicProfile {
  uid: string;
  name: string;
  className: string;
  coins: number;
  theme: ThemeKey;
  avatarUrl: string;
}

const ENGLISH_WORDS: WordItem[] = [
  { id: 'en-1', text: 'hello', lang: 'en' },
  { id: 'en-2', text: 'name', lang: 'en' },
  { id: 'en-3', text: 'my', lang: 'en' },
  { id: 'en-4', text: 'your', lang: 'en' },
  { id: 'en-5', text: 'pencil', lang: 'en' },
  { id: 'en-6', text: 'pen', lang: 'en' },
  { id: 'en-7', text: 'bag', lang: 'en' },
  { id: 'en-8', text: 'book', lang: 'en' },
  { id: 'en-9', text: 'desk', lang: 'en' },
  { id: 'en-10', text: 'chair', lang: 'en' },
  { id: 'en-11', text: 'ruler', lang: 'en' },
  { id: 'en-12', text: 'eraser', lang: 'en' },
  { id: 'en-13', text: 'map', lang: 'en' },
  { id: 'en-14', text: 'marker', lang: 'en' },
  { id: 'en-15', text: 'globe', lang: 'en' },
];

const THAI_WORDS: WordItem[] = [
  { id: 'th-1', text: 'กา', lang: 'th' },
  { id: 'th-2', text: 'กิน', lang: 'th' },
  { id: 'th-3', text: 'ไก่', lang: 'th' },
  { id: 'th-4', text: 'เก้า', lang: 'th' },
  { id: 'th-5', text: 'เก็บ', lang: 'th' },
  { id: 'th-6', text: 'เก่ง', lang: 'th' },
  { id: 'th-7', text: 'ขา', lang: 'th' },
  { id: 'th-8', text: 'ของ', lang: 'th' },
  { id: 'th-9', text: 'เข่า', lang: 'th' },
  { id: 'th-10', text: 'ข้าง', lang: 'th' },
  { id: 'th-11', text: 'เขี่ย', lang: 'th' },
  { id: 'th-12', text: 'ขวา', lang: 'th' },
  { id: 'th-13', text: 'คำ', lang: 'th' },
  { id: 'th-14', text: 'คน', lang: 'th' },
  { id: 'th-15', text: 'คืน', lang: 'th' },
  { id: 'th-16', text: 'ครู', lang: 'th' },
  { id: 'th-17', text: 'คุย', lang: 'th' },
  { id: 'th-18', text: 'คิด', lang: 'th' },
  { id: 'th-19', text: 'งา', lang: 'th' },
  { id: 'th-20', text: 'งวง', lang: 'th' },
];

const THEME_OPTIONS: {
  key: ThemeKey;
  title: string;
  short: string;
  emoji: string;
  description: string;
}[] = [
  {
    key: 'minecraft',
    title: 'ธีมสีเขียว Minecraft',
    short: 'Minecraft',
    emoji: '🟩',
    description: 'โทนเขียวแบบบล็อก ๆ สดใส สนุกเหมือนโลกพิกเซล',
  },
  {
    key: 'pinkRabbit',
    title: 'ธีมสีชมพู กระต่าย',
    short: 'Rabbit',
    emoji: '🐰',
    description: 'หวานน่ารัก ฟรุ้งฟริ้ง ดูเหมือนแอพราคาสูง',
  },
  {
    key: 'snowPrincess',
    title: 'ธีมสีฟ้า เจ้าหญิงหิมะ',
    short: 'Snow Princess',
    emoji: '❄️',
    description: 'ฟ้าสดใส หิมะเบา ๆ นุ่มนวล หรูหรา',
  },
  {
    key: 'spongeSea',
    title: 'ธีมสีเหลือง Sponge Bob',
    short: 'Sponge Sea',
    emoji: '⭐',
    description: 'ทะเลสดใส สีเหลืองสนุกสนาน พร้อมบรรยากาศใต้น้ำ',
  },
];

const REWARD_ITEMS = [
  { id: 'reward-100', title: 'โหลด 1 เกมส์', cost: 100, emoji: '🎮' },
  { id: 'reward-200', title: 'กินสุกี้ BONUS', cost: 200, emoji: '🍲' },
  { id: 'reward-300', title: 'ได้ของเล่น 1 ชิ้น', cost: 300, emoji: '🧸' },
];

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  className: '',
  coins: 0,
  theme: 'snowPrincess',
  avatarUrl: '',
  completedWords: [],
  claimedRewardIds: [],
  email: '',
};

function normalizeWord(word: string, lang: LangKey) {
  const clean = word.replace(/\s+/g, '');
  return lang === 'en' ? clean.toLowerCase() : clean;
}

function splitChars(word: string) {
  return Array.from(word);
}

function shuffleArray<T>(items: T[]) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildLetterBank(word: string, lang: LangKey) {
  const answerChars = splitChars(normalizeWord(word, lang));
  const enExtras = splitChars('abcdefghijklmnopqrstuvwxyz');
  const thExtras = splitChars('กขฃคฆงจฉชซญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮะาำิีึืุูเแโใไ่้๊๋์');
  const extrasSource = lang === 'en' ? enExtras : thExtras;

  const extras: string[] = [];
  while (extras.length < Math.min(5, Math.max(3, answerChars.length))) {
    const randomChar = extrasSource[Math.floor(Math.random() * extrasSource.length)];
    if (!answerChars.includes(randomChar) && !extras.includes(randomChar)) {
      extras.push(randomChar);
    }
  }

  return shuffleArray([...answerChars, ...extras]);
}

function getWordKey(item: WordItem) {
  return `${item.lang}:${item.id}:${normalizeWord(item.text, item.lang)}`;
}

function App() {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const [registerName, setRegisterName] = useState('');
  const [registerClassName, setRegisterClassName] = useState('');
  const [email, setEmail] = useState('pond01@wordstar.local');
  const [password, setPassword] = useState('123456');
  const [authError, setAuthError] = useState('');

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>('learn');
  const [language, setLanguage] = useState<LangKey>('en');
  const [wordIndex, setWordIndex] = useState(0);

  const [letterBank, setLetterBank] = useState<string[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [feedback, setFeedback] = useState('');
  const [checkState, setCheckState] = useState<'idle' | 'success' | 'error'>('idle');
  const [showAnswer, setShowAnswer] = useState(false);

  const [leaderboard, setLeaderboard] = useState<PublicProfile[]>([]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const isDrawingRef = useRef(false);
  const hasDrawnRef = useRef(false);

  const currentWords = language === 'en' ? ENGLISH_WORDS : THAI_WORDS;

  const currentWord = useMemo(() => {
    if (wordIndex > currentWords.length - 1) {
      return currentWords[0];
    }
    return currentWords[wordIndex];
  }, [currentWords, wordIndex]);

  const selectedText = selectedIndices.map((index) => letterBank[index]).join('');
  const normalizedSelectedText = language === 'en' ? selectedText.toLowerCase() : selectedText;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);

      if (!firebaseUser) {
        setProfile(null);
        return;
      }

      setProfileLoading(true);
      try {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const data = snap.data() as Partial<UserProfile>;
          const nextProfile: UserProfile = {
            ...DEFAULT_PROFILE,
            ...data,
            email: data.email || firebaseUser.email || '',
          };
          setProfile(nextProfile);
        } else {
          const nextProfile: UserProfile = {
            ...DEFAULT_PROFILE,
            name: firebaseUser.email?.split('@')[0] || 'เด็กน้อย',
            email: firebaseUser.email || '',
          };
          await setDoc(userRef, {
            ...nextProfile,
            updatedAt: serverTimestamp(),
          });
          await setDoc(
            doc(db, 'publicProfiles', firebaseUser.uid),
            {
              uid: firebaseUser.uid,
              name: nextProfile.name,
              className: nextProfile.className,
              coins: nextProfile.coins,
              theme: nextProfile.theme,
              avatarUrl: nextProfile.avatarUrl,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          setProfile(nextProfile);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setProfileLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'publicProfiles'), orderBy('coins', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: PublicProfile[] = snapshot.docs.map((item) => {
        const data = item.data() as Omit<PublicProfile, 'uid'>;
        return {
          uid: item.id,
          name: data.name || 'เด็กน้อย',
          className: data.className || '',
          coins: data.coins || 0,
          theme: data.theme || 'snowPrincess',
          avatarUrl: data.avatarUrl || '',
        };
      });
      setLeaderboard(items);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (wordIndex > currentWords.length - 1) {
      setWordIndex(0);
    }
  }, [currentWords, wordIndex]);

  useEffect(() => {
    if (!currentWord) return;
    setLetterBank(buildLetterBank(currentWord.text, currentWord.lang));
    setSelectedIndices([]);
    setFeedback('');
    setCheckState('idle');
    setShowAnswer(false);
    clearCanvas();
    setTimeout(() => {
      speakWord(currentWord.text, currentWord.lang);
    }, 300);
  }, [currentWord]);

  useEffect(() => {
    const onResize = () => {
      setupCanvas();
    };

    window.addEventListener('resize', onResize);
    setTimeout(() => setupCanvas(), 100);

    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [activeTab]);

  async function upsertPublicProfile(nextProfile: UserProfile, currentUser: User) {
    await setDoc(
      doc(db, 'publicProfiles', currentUser.uid),
      {
        uid: currentUser.uid,
        name: nextProfile.name,
        className: nextProfile.className,
        coins: nextProfile.coins,
        theme: nextProfile.theme,
        avatarUrl: nextProfile.avatarUrl,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  async function saveProfilePatch(patch: Partial<UserProfile>) {
    if (!user || !profile) return;

    const nextProfile: UserProfile = {
      ...profile,
      ...patch,
    };

    setProfile(nextProfile);

    await setDoc(
      doc(db, 'users', user.uid),
      {
        ...patch,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    await upsertPublicProfile(nextProfile, user);
  }

  async function handleAuthSubmit() {
    try {
      setAuthError('');

      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);

        const newProfile: UserProfile = {
          ...DEFAULT_PROFILE,
          name: registerName.trim() || 'เด็กน้อย',
          className: registerClassName.trim(),
          email: email.trim(),
        };

        await setDoc(doc(db, 'users', cred.user.uid), {
          ...newProfile,
          updatedAt: serverTimestamp(),
        });

        await setDoc(
          doc(db, 'publicProfiles', cred.user.uid),
          {
            uid: cred.user.uid,
            name: newProfile.name,
            className: newProfile.className,
            coins: newProfile.coins,
            theme: newProfile.theme,
            avatarUrl: newProfile.avatarUrl,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        setProfile(newProfile);
      }
    } catch (error: any) {
      setAuthError(error?.message || 'เข้าสู่ระบบไม่สำเร็จ');
    }
  }

  function speakWord(text: string, lang: LangKey) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = lang === 'en' ? 'en-US' : 'th-TH';
    speech.rate = lang === 'en' ? 0.85 : 0.9;
    speech.pitch = 1;
    window.speechSynthesis.speak(speech);
  }

  function setupCanvas() {
    const canvas = canvasRef.current;
    const wrap = canvasWrapRef.current;
    if (!canvas || !wrap) return;

    const rect = wrap.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;

    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 6;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawnRef.current = false;
  }

  function getPointerPosition(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getPointerPosition(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawingRef.current = true;
    hasDrawnRef.current = true;

    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getPointerPosition(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    isDrawingRef.current = false;
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }

  function handlePickLetter(index: number) {
    if (selectedIndices.includes(index)) return;
    setSelectedIndices((prev) => [...prev, index]);
  }

  function handleRemoveLastLetter() {
    setSelectedIndices((prev) => prev.slice(0, -1));
  }

  function handleResetLetters() {
    setSelectedIndices([]);
  }

  async function handleCheckAnswer() {
    if (!profile || !user) return;

    const expected = normalizeWord(currentWord.text, currentWord.lang);
    const wordKey = getWordKey(currentWord);

    if (!hasDrawnRef.current) {
      setCheckState('error');
      setFeedback('ต้องลองเขียนคำนี้ในช่องก่อน แล้วค่อยตรวจคำตอบ');
      return;
    }

    if (normalizedSelectedText !== expected) {
      setCheckState('error');
      setFeedback('เรียงตัวอักษรยังไม่ถูก ลองใหม่อีกครั้งนะ');
      return;
    }

    if (profile.completedWords.includes(wordKey)) {
      setCheckState('success');
      setFeedback('เก่งมาก! คำนี้เคยได้คะแนนแล้ว แต่ยังฝึกซ้ำได้');
      return;
    }

    const nextCompletedWords = [...profile.completedWords, wordKey];
    const nextCoins = profile.coins + 1;

    await saveProfilePatch({
      coins: nextCoins,
      completedWords: nextCompletedWords,
    });

    setCheckState('success');
    setFeedback('ถูกต้อง! ได้ 1 คะแนน 🎉');
  }

  async function handleThemeChange(theme: ThemeKey) {
    if (!profile) return;
    setSavingProfile(true);
    try {
      await saveProfilePatch({ theme });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleProfileSave() {
    if (!profile) return;
    setSavingProfile(true);
    try {
      await saveProfilePatch({
        name: profile.name,
        className: profile.className,
      });
      alert('บันทึกโปรไฟล์เรียบร้อยแล้ว');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (!user || !profile) return;

    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);

    try {
      const fileRef = ref(storage, `avatars/${user.uid}/${Date.now()}-${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      await saveProfilePatch({
        avatarUrl: url,
      });

      alert('อัปโหลดรูปโปรไฟล์เรียบร้อยแล้ว');
    } catch (error) {
      console.error(error);
      alert('อัปโหลดรูปไม่สำเร็จ');
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleClaimReward(rewardId: string) {
    if (!profile) return;

    const reward = REWARD_ITEMS.find((item) => item.id === rewardId);
    if (!reward) return;

    if (profile.claimedRewardIds.includes(rewardId)) {
      alert('รับรางวัลนี้ไปแล้ว');
      return;
    }

    if (profile.coins < reward.cost) {
      alert(`ยังมีคะแนนไม่พอ ต้องมีอย่างน้อย ${reward.cost} คะแนน`);
      return;
    }

    const nextRewardIds = [...profile.claimedRewardIds, rewardId];
    await saveProfilePatch({ claimedRewardIds: nextRewardIds });
    alert(`รับรางวัล "${reward.title}" เรียบร้อยแล้ว`);
  }

  function handleNextWord() {
    setWordIndex((prev) => (prev + 1) % currentWords.length);
  }

  function handlePrevWord() {
    setWordIndex((prev) => (prev - 1 + currentWords.length) % currentWords.length);
  }

  async function handleLogout() {
    await signOut(auth);
    setActiveTab('learn');
    setProfile(null);
  }

  function getRank() {
    if (!user) return '-';
    const index = leaderboard.findIndex((item) => item.uid === user.uid);
    if (index === -1) return '-';
    return `#${index + 1}`;
  }

  function getThemeClass(theme: ThemeKey) {
    switch (theme) {
      case 'minecraft':
        return 'theme-minecraft';
      case 'pinkRabbit':
        return 'theme-rabbit';
      case 'snowPrincess':
        return 'theme-snow';
      case 'spongeSea':
        return 'theme-sponge';
      default:
        return 'theme-snow';
    }
  }

  if (authLoading || profileLoading) {
    return (
      <div className="loadingScreen">
        <div className="loadingCard">
          <div className="loadingEmoji">⭐</div>
          <h2>กำลังโหลด Word Star Kids...</h2>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="authPage">
        <div className="authCard">
          <div className="authBrand">Word Star Kids</div>
          <p className="authSub">เข้าสู่ระบบเพื่อเก็บคะแนนและแข่งกับเพื่อน</p>

          <div className="authSwitch">
            <button
              className={authMode === 'login' ? 'authSwitchBtn active' : 'authSwitchBtn'}
              onClick={() => setAuthMode('login')}
            >
              Login
            </button>
            <button
              className={authMode === 'register' ? 'authSwitchBtn active' : 'authSwitchBtn'}
              onClick={() => setAuthMode('register')}
            >
              Register
            </button>
          </div>

          {authMode === 'register' && (
            <>
              <label>ชื่อเด็ก</label>
              <input
                value={registerName}
                onChange={(e) => setRegisterName(e.target.value)}
                placeholder="เช่น น้องต้นกล้า"
              />

              <label>ห้องเรียน</label>
              <input
                value={registerClassName}
                onChange={(e) => setRegisterClassName(e.target.value)}
                placeholder="เช่น ป.1/1"
              />
            </>
          )}

          <label>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="เช่น pond01@wordstar.local"
          />

          <label>Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
          />

          {authError && <div className="authError">{authError}</div>}

          <button className="authSubmit" onClick={handleAuthSubmit}>
            {authMode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
          </button>

          <div className="authHint">
            ช่วงทดลองสามารถใช้ email สมมติได้ เช่น pond01@wordstar.local และ password อย่างน้อย 6 ตัว
          </div>
        </div>
      </div>
    );
  }

  const themeClass = getThemeClass(profile.theme);

  return (
    <div className={`appShell ${themeClass}`}>
      <div className="backgroundDecor decorOne" />
      <div className="backgroundDecor decorTwo" />
      <div className="backgroundDecor decorThree" />

      <div className="appContainer">
        <header className="topBar glassCard">
          <div>
            <div className="brandTitle">Word Star Kids</div>
            <div className="brandSub">เรียนคำศัพท์ • สนุกทุกวัน • เก่งขึ้นทุกวัน</div>
          </div>

          <div className="topBarRight">
            <div className="coinBadge">🪙 {profile.coins}</div>
            <div className="rankBadge">🏆 {getRank()}</div>
            <div className="avatarBadge">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="avatar" />
              ) : (
                <span>🧒</span>
              )}
            </div>
          </div>
        </header>

        <main className="mainContent">
          {activeTab === 'learn' && (
            <section className="screenCard lessonScreen">
              <div className="sectionTitle">ฝึกเขียนคำศัพท์</div>

              <div className="languageTabs">
                <button
                  className={language === 'en' ? 'langBtn active' : 'langBtn'}
                  onClick={() => {
                    setLanguage('en');
                    setWordIndex(0);
                  }}
                >
                  GB ภาษาอังกฤษ
                </button>
                <button
                  className={language === 'th' ? 'langBtn active' : 'langBtn'}
                  onClick={() => {
                    setLanguage('th');
                    setWordIndex(0);
                  }}
                >
                  TH ภาษาไทย
                </button>
                <button
                  className={showAnswer ? 'langBtn answer active' : 'langBtn answer'}
                  onClick={() => setShowAnswer((prev) => !prev)}
                >
                  {showAnswer ? 'ซ่อนเฉลย' : 'ดูคำเฉลย'}
                </button>
              </div>

              <div className="heroPrompt glassCard">
                <div className="heroPromptIcon">
                  {profile.theme === 'minecraft' && '🟩'}
                  {profile.theme === 'pinkRabbit' && '🐰'}
                  {profile.theme === 'snowPrincess' && '❄️'}
                  {profile.theme === 'spongeSea' && '🌊'}
                </div>

                <div className="heroPromptCenter">
                  <div className="bigQuestion">{showAnswer ? currentWord.text : '?'}</div>
                  <div className="heroPromptText">
                    ฟังเสียง → เรียงตัวอักษร → เขียนคำนี้ลงในช่อง
                  </div>
                </div>

                <button
                  className="speakButton"
                  onClick={() => speakWord(currentWord.text, currentWord.lang)}
                >
                  🔊 ฟังเสียง
                </button>
              </div>

              <div className="lessonGrid">
                <div className="leftColumn">
                  <div className="practiceCard glassCard">
                    <div className="cardTitle">เรียงตัวอักษรให้ถูกต้อง</div>

                    <div className="answerSlots">
                      {splitChars(normalizeWord(currentWord.text, currentWord.lang)).map((_, slotIndex) => (
                        <div className="answerSlot" key={`slot-${slotIndex}`}>
                          {selectedIndices[slotIndex] !== undefined
                            ? letterBank[selectedIndices[slotIndex]]
                            : ''}
                        </div>
                      ))}
                    </div>

                    <div className="letterTray">
                      {letterBank.map((char, index) => {
                        const used = selectedIndices.includes(index);
                        return (
                          <button
                            key={`${char}-${index}`}
                            className={used ? 'letterButton used' : 'letterButton'}
                            onClick={() => handlePickLetter(index)}
                            disabled={used}
                          >
                            {char}
                          </button>
                        );
                      })}
                    </div>

                    <div className="miniControls">
                      <button className="miniBtn" onClick={handleRemoveLastLetter}>
                        ↩ ลบตัวท้าย
                      </button>
                      <button className="miniBtn" onClick={handleResetLetters}>
                        🧽 ล้างคำ
                      </button>
                    </div>
                  </div>

                  <div className="practiceCard glassCard">
                    <div className="cardTitle">เขียนคำศัพท์ตรงนี้</div>

                    <div className="writingPad" ref={canvasWrapRef}>
                      <div className="writingLines" />
                      <canvas
                        ref={canvasRef}
                        className="writingCanvas"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                      />
                      <button className="clearCanvasBtn" onClick={clearCanvas}>
                        ✏️ ล้างเส้น
                      </button>
                    </div>

                    <div className="actionRow">
                      <button className="navBtn" onClick={handlePrevWord}>
                        ← คำก่อนหน้า
                      </button>
                      <button className="checkBtn" onClick={handleCheckAnswer}>
                        ✅ ตรวจคำตอบ
                      </button>
                      <button className="navBtn" onClick={handleNextWord}>
                        คำถัดไป →
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rightColumn">
                  <div className={checkState === 'success' ? 'resultCard success' : 'resultCard'}>
                    <div className="resultEmoji">⭐</div>
                    <div className="resultTitle">ผลการตรวจ</div>
                    <div className="resultText">
                      {feedback || 'กดตรวจคำตอบเมื่อเรียงคำและเขียนเสร็จแล้ว'}
                    </div>
                  </div>

                  <div className="infoCard glassCard">
                    <div className="cardTitle">สถานะปัจจุบัน</div>
                    <div className="infoLine">ภาษา: {language === 'en' ? 'อังกฤษ' : 'ไทย'}</div>
                    <div className="infoLine">
                      คำที่: {wordIndex + 1} / {currentWords.length}
                    </div>
                    <div className="infoLine">คะแนนของฉัน: {profile.coins} คะแนน</div>
                  </div>

                  <div className="infoCard glassCard">
                    <div className="cardTitle">วิธีเล่น</div>
                    <ul className="tipsList">
                      <li>กดฟังเสียงอัตโนมัติเมื่อเปลี่ยนคำ</li>
                      <li>ลากสายตาดูถาดตัวอักษร แล้วกดเรียงให้ถูก</li>
                      <li>เขียนคำลงในช่องด้วยนิ้ว / เมาส์ / ปากกา</li>
                      <li>ถ้าเรียงคำถูกและมีการเขียน จะได้ 1 คะแนน</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'score' && (
            <section className="screenCard">
              <div className="sectionTitle">คะแนนของฉัน</div>

              <div className="scoreTopRow">
                <div className="scoreBox glassCard">
                  <div className="scoreIcon">🪙</div>
                  <div className="scoreLabel">คะแนนปัจจุบัน</div>
                  <div className="scoreValue">{profile.coins}</div>
                </div>

                <div className="scoreBox glassCard">
                  <div className="scoreIcon">🏆</div>
                  <div className="scoreLabel">อันดับของฉัน</div>
                  <div className="scoreValue">{getRank()}</div>
                </div>
              </div>

              <div className="leaderboardCard glassCard">
                <div className="cardTitle">ตารางอันดับเพื่อน</div>

                <div className="leaderboardList">
                  {leaderboard.map((item, index) => {
                    const isMe = user?.uid === item.uid;
                    return (
                      <div key={item.uid} className={isMe ? 'leaderItem me' : 'leaderItem'}>
                        <div className="leaderLeft">
                          <div className="leaderRank">{index + 1}</div>
                          <div className="leaderAvatar">
                            {item.avatarUrl ? (
                              <img src={item.avatarUrl} alt={item.name} />
                            ) : (
                              <span>🧒</span>
                            )}
                          </div>
                          <div>
                            <div className="leaderName">
                              {item.name} {isMe ? '(ฉัน)' : ''}
                            </div>
                            <div className="leaderClass">{item.className || 'ยังไม่ได้ระบุห้อง'}</div>
                          </div>
                        </div>
                        <div className="leaderCoins">{item.coins} คะแนน</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {activeTab === 'shop' && (
            <section className="screenCard">
              <div className="sectionTitle">ร้านของรางวัล</div>

              <div className="shopGrid">
                {REWARD_ITEMS.map((reward) => {
                  const claimed = profile.claimedRewardIds.includes(reward.id);
                  const canClaim = profile.coins >= reward.cost && !claimed;

                  return (
                    <div key={reward.id} className="rewardCard glassCard">
                      <div className="rewardEmoji">{reward.emoji}</div>
                      <div className="rewardTitle">{reward.title}</div>
                      <div className="rewardCost">{reward.cost} คะแนน</div>

                      <button
                        className={claimed ? 'rewardBtn done' : canClaim ? 'rewardBtn' : 'rewardBtn disabled'}
                        onClick={() => handleClaimReward(reward.id)}
                        disabled={!canClaim}
                      >
                        {claimed ? 'รับแล้ว' : canClaim ? 'แลกรางวัล' : 'คะแนนไม่พอ'}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="shopNote glassCard">
                คะแนนของฉันตอนนี้: <strong>{profile.coins}</strong> คะแนน
              </div>
            </section>
          )}

          {activeTab === 'profile' && (
            <section className="screenCard">
              <div className="sectionTitle">โปรไฟล์</div>

              <div className="profileGrid">
                <div className="profileMain glassCard">
                  <div className="profileHeader">
                    <div className="profileAvatarLarge">
                      {profile.avatarUrl ? (
                        <img src={profile.avatarUrl} alt="profile" />
                      ) : (
                        <span>🧒</span>
                      )}
                    </div>

                    <div className="profileUploadBlock">
                      <div className="cardTitle">รูปโปรไฟล์</div>
                      <label className="uploadBtn">
                        {uploadingAvatar ? 'กำลังอัปโหลด...' : 'อัปโหลดรูปหน้าตัวเอง'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          disabled={uploadingAvatar}
                        />
                      </label>
                      <div className="smallHint">
                        รูปนี้จะถูกใช้แสดงในหน้า leaderboard ให้เพื่อนเห็น
                      </div>
                    </div>
                  </div>

                  <div className="profileForm">
                    <label>ชื่อเด็ก</label>
                    <input
                      value={profile.name}
                      onChange={(e) =>
                        setProfile((prev) =>
                          prev ? { ...prev, name: e.target.value } : prev
                        )
                      }
                    />

                    <label>ห้องเรียน</label>
                    <input
                      value={profile.className}
                      onChange={(e) =>
                        setProfile((prev) =>
                          prev ? { ...prev, className: e.target.value } : prev
                        )
                      }
                      placeholder="เช่น ป.1/1"
                    />

                    <label>Email</label>
                    <input value={profile.email} disabled />

                    <button className="saveProfileBtn" onClick={handleProfileSave} disabled={savingProfile}>
                      {savingProfile ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                    </button>
                  </div>
                </div>

                <div className="themePanel glassCard">
                  <div className="cardTitle">เลือกธีมของฉัน</div>

                  <div className="themeList">
                    {THEME_OPTIONS.map((theme) => (
                      <button
                        key={theme.key}
                        className={profile.theme === theme.key ? 'themeChoice active' : 'themeChoice'}
                        onClick={() => handleThemeChange(theme.key)}
                      >
                        <div className="themePreview">
                          <div className={`themeMini ${getThemeClass(theme.key)}`} />
                        </div>
                        <div className="themeInfo">
                          <div className="themeName">
                            {theme.emoji} {theme.title}
                          </div>
                          <div className="themeDesc">{theme.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>

        <nav className="bottomNav glassCard">
          <button
            className={activeTab === 'learn' ? 'navItem active' : 'navItem'}
            onClick={() => setActiveTab('learn')}
          >
            📘 เรียน
          </button>
          <button
            className={activeTab === 'score' ? 'navItem active' : 'navItem'}
            onClick={() => setActiveTab('score')}
          >
            🏆 คะแนน
          </button>
          <button
            className={activeTab === 'shop' ? 'navItem active' : 'navItem'}
            onClick={() => setActiveTab('shop')}
          >
            🎁 ร้านค้า
          </button>
          <button
            className={activeTab === 'profile' ? 'navItem active' : 'navItem'}
            onClick={() => setActiveTab('profile')}
          >
            👤 โปรไฟล์
          </button>
          <button className="navItem logout" onClick={handleLogout}>
            🚪 ออก
          </button>
        </nav>
      </div>
    </div>
  );
}

export default App;
