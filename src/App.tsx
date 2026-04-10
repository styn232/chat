import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageCircle, 
  Users, 
  Heart, 
  User as UserIcon, 
  Send, 
  Plus, 
  MoreVertical, 
  Search,
  LogOut,
  Camera,
  Flame,
  Settings,
  Bell,
  ArrowLeft,
  Sun,
  Moon,
  Shield
} from 'lucide-react';
import { auth, db } from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  where,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  increment,
  limit
} from 'firebase/firestore';
import { cn } from './lib/utils';
import { Toaster, toast } from 'sonner';
import axios from 'axios';

// --- Helpers ---
const uploadToServer = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await axios.post('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data.url;
  } catch (error) {
    console.error('Server upload error:', error);
    toast.error('Failed to upload file to server');
    return null;
  }
};

// --- Types ---
interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: any;
  roomId?: string;
  groupId?: string;
}

interface Group {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  members: string[];
  createdAt: any;
}

interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  content: string;
  imageUrl?: string;
  likes: number;
  createdAt: any;
}

interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  bio?: string;
  age?: number;
  country?: string;
  city?: string;
  gender?: 'male' | 'female' | 'other';
  isPremium?: boolean;
  role: 'user' | 'admin';
}

interface AppConfig {
  proPrice: number;
  manualPaymentInfo: string;
}

interface PaymentRequest {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: any;
}

interface TypingIndicator {
  id: string;
  userId: string;
  userName: string;
  roomId: string;
  isTyping: boolean;
  lastUpdated: any;
}

// --- Components ---

const AdminDashboard = ({ user }: { user: FirebaseUser }) => {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [config, setConfig] = useState<AppConfig>({ proPrice: 10, manualPaymentInfo: 'Pay via PayPal: admin@styni.com' });
  const [editingConfig, setEditingConfig] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'paymentRequests'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentRequest)));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const configRef = doc(db, 'config', 'global');
    const unsubscribe = onSnapshot(configRef, (snap) => {
      if (snap.exists()) {
        setConfig(snap.data() as AppConfig);
      }
    });
    return unsubscribe;
  }, []);

  const handleApprove = async (req: PaymentRequest) => {
    try {
      await updateDoc(doc(db, 'paymentRequests', req.id), { status: 'approved' });
      await updateDoc(doc(db, 'users', req.userId), { isPremium: true });
      toast.success('Payment approved and user upgraded!');
    } catch (error) {
      toast.error('Failed to approve payment');
    }
  };

  const handleUpdateConfig = async () => {
    try {
      await setDoc(doc(db, 'config', 'global'), config);
      setEditingConfig(false);
      toast.success('Config updated!');
    } catch (error) {
      toast.error('Failed to update config');
    }
  };

  return (
    <div className="p-6 space-y-8 overflow-y-auto h-full pb-24 bg-[var(--bg-app)]">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Admin Dashboard</h2>
        <button 
          onClick={() => setEditingConfig(!editingConfig)}
          className="p-2 bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)]"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {editingConfig && (
        <div className="bg-[var(--bg-card)] p-4 rounded-2xl border border-[var(--border-color)] space-y-4">
          <h3 className="font-bold">Global Settings</h3>
          <div className="space-y-2">
            <label className="text-xs text-[var(--text-secondary)]">Pro Price ($)</label>
            <input 
              type="number"
              value={config.proPrice}
              onChange={(e) => setConfig({ ...config, proPrice: Number(e.target.value) })}
              className="w-full bg-[var(--bg-input)] rounded-lg p-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-[var(--text-secondary)]">Payment Instructions</label>
            <textarea 
              value={config.manualPaymentInfo}
              onChange={(e) => setConfig({ ...config, manualPaymentInfo: e.target.value })}
              className="w-full bg-[var(--bg-input)] rounded-lg p-2 text-sm h-24"
            />
          </div>
          <button 
            onClick={handleUpdateConfig}
            className="w-full py-2 bg-[var(--accent)] text-white rounded-lg font-bold"
          >
            Save Changes
          </button>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="font-bold">Pending Payments</h3>
        {requests.filter(r => r.status === 'pending').length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)] italic">No pending requests.</p>
        ) : (
          requests.filter(r => r.status === 'pending').map(req => (
            <div key={req.id} className="bg-[var(--bg-card)] p-4 rounded-2xl border border-[var(--border-color)] flex items-center justify-between">
              <div>
                <p className="font-bold">{req.userName || 'Unknown User'}</p>
                <p className="text-xs text-[var(--text-secondary)]">${req.amount}</p>
              </div>
              <button 
                onClick={() => handleApprove(req)}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-xs font-bold"
              >
                Approve
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const Login = () => {
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          role: 'user',
          createdAt: serverTimestamp(),
        });
      }
      toast.success('Welcome back!');
    } catch (error) {
      console.error(error);
      toast.error('Login failed');
    }
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center bg-[#0b141a] text-white p-6"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
    >
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center space-y-12"
      >
        <div className="space-y-6">
          <motion.div 
            animate={{ 
              scale: [1, 1.05, 1],
              rotate: [0, 2, -2, 0]
            }}
            transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
            className="w-28 h-28 bg-emerald-500 rounded-[2.5rem] mx-auto flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.3)]"
          >
            <Flame className="w-14 h-14 text-white fill-white" />
          </motion.div>
          
          <div className="space-y-2">
            <h1 className="text-6xl font-black tracking-tighter text-white">Heart</h1>
            <div className="flex items-center justify-center gap-2">
              <div className="h-[1px] w-8 bg-emerald-500/30" />
              <p className="text-emerald-500 font-black tracking-[0.2em] uppercase text-[10px]">Styn Africa Premium</p>
              <div className="h-[1px] w-8 bg-emerald-500/30" />
            </div>
          </div>
          
          <p className="text-zinc-400 text-sm max-w-[280px] mx-auto leading-relaxed">
            The most powerful social & matching platform in Africa.
          </p>
        </div>
        
        <div className="space-y-4">
          <button 
            onClick={handleLogin}
            className="w-full py-4 bg-white text-black font-black rounded-2xl hover:bg-zinc-200 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-2xl"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Continue with Google
          </button>
          <p className="text-[10px] text-zinc-500 font-medium">
            By continuing, you agree to our <span className="underline">Terms</span> & <span className="underline">Privacy Policy</span>.
          </p>
        </div>

        <div className="pt-16 flex items-center justify-center gap-6 opacity-10 grayscale">
          <div className="h-3 w-16 bg-white rounded-full" />
          <div className="h-3 w-12 bg-white rounded-full" />
          <div className="h-3 w-20 bg-white rounded-full" />
        </div>
      </motion.div>
    </div>
  );
};

const ChatView = ({ user, profile }: { user: FirebaseUser, profile: UserProfile }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<any[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'groups'), where('members', 'array-contains', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group)));
    });
    return unsubscribe;
  }, [user.uid]);

  useEffect(() => {
    const q = query(collection(db, 'groups'), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group)));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!selectedGroup) return;
    const q = query(
      collection(db, 'messages'), 
      where('groupId', '==', selectedGroup.id),
      orderBy('timestamp', 'asc'), 
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
    });
    return unsubscribe;
  }, [selectedGroup]);

  useEffect(() => {
    if (!selectedGroup) return;
    const q = query(
      collection(db, 'typing'),
      where('roomId', '==', selectedGroup.id),
      where('isTyping', '==', true)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const typing = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as TypingIndicator))
        .filter(t => t.userId !== user.uid);
      setTypingUsers(typing);
    });
    return unsubscribe;
  }, [selectedGroup, user.uid]);

  const updateTypingStatus = async (isTyping: boolean) => {
    if (!selectedGroup) return;
    const typingId = `${selectedGroup.id}_${user.uid}`;
    try {
      await setDoc(doc(db, 'typing', typingId), {
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        roomId: selectedGroup.id,
        isTyping,
        lastUpdated: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error("Error updating typing status:", error);
    }
  };

  const handleTyping = () => {
    updateTypingStatus(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      updateTypingStatus(false);
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (selectedGroup) {
        updateTypingStatus(false);
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [selectedGroup]);

  useEffect(() => {
    if (isSearching) {
      const q = query(
        collection(db, 'searchHistory'), 
        where('userId', '==', user.uid), 
        orderBy('timestamp', 'desc'), 
        limit(5)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setRecentSearches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return unsubscribe;
    }
  }, [isSearching, user.uid]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      await addDoc(collection(db, 'groups'), {
        name: newGroupName,
        description: newGroupDesc,
        createdBy: user.uid,
        members: [user.uid],
        createdAt: serverTimestamp(),
      });
      setNewGroupName('');
      setNewGroupDesc('');
      setShowCreateGroup(false);
      toast.success('Group created!');
    } catch (error) {
      toast.error('Failed to create group');
    }
  };

  const joinGroup = async (groupId: string) => {
    try {
      const groupRef = doc(db, 'groups', groupId);
      const groupSnap = await getDoc(groupRef);
      if (groupSnap.exists()) {
        const members = groupSnap.data().members || [];
        if (!members.includes(user.uid)) {
          await updateDoc(groupRef, {
            members: [...members, user.uid]
          });
          toast.success('Joined group!');
        }
      }
    } catch (error) {
      toast.error('Failed to join group');
    }
  };

  const saveSearchQuery = async (queryText: string) => {
    if (!queryText.trim()) return;
    try {
      await addDoc(collection(db, 'searchHistory'), {
        userId: user.uid,
        query: queryText,
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error saving search:", error);
    }
  };

  const filteredMessages = messages.filter(msg => {
    if (!searchQuery) return true;
    const lowerQuery = searchQuery.toLowerCase();
    return msg.text.toLowerCase().includes(lowerQuery) || 
           msg.senderId.toLowerCase().includes(lowerQuery);
  });

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedGroup) return;

    if (!profile.isPremium) {
      toast.error('Only Pro members can chat. Upgrade in the Match tab!');
      return;
    }

    try {
      await addDoc(collection(db, 'messages'), {
        senderId: user.uid,
        groupId: selectedGroup.id,
        text: newMessage,
        timestamp: serverTimestamp(),
      });
      setNewMessage('');
      updateTypingStatus(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    } catch (error) {
      toast.error('Failed to send message');
    }
  };

  if (!selectedGroup) {
    return (
      <div className="flex flex-col h-full bg-[#0b141a]">
        <div className="p-4 bg-[#202c33] flex items-center justify-between shadow-md">
          <h2 className="text-xl font-bold text-zinc-100">Chats</h2>
          <div className="flex gap-4 text-zinc-400">
            <Plus className="w-5 h-5 cursor-pointer" onClick={() => setShowCreateGroup(true)} />
            <MoreVertical className="w-5 h-5" />
          </div>
        </div>

        {showCreateGroup && (
          <div className="p-4 bg-[#111b21] border-b border-zinc-800 space-y-3">
            <input 
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Group Name"
              className="w-full bg-[#2a3942] rounded-lg px-4 py-2 text-sm text-zinc-100 outline-none"
            />
            <input 
              value={newGroupDesc}
              onChange={(e) => setNewGroupDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full bg-[#2a3942] rounded-lg px-4 py-2 text-sm text-zinc-100 outline-none"
            />
            <div className="flex gap-2">
              <button 
                onClick={createGroup}
                className="flex-1 py-2 bg-[#00a884] text-white rounded-lg text-sm font-bold"
              >
                Create
              </button>
              <button 
                onClick={() => setShowCreateGroup(false)}
                className="px-4 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-[10px] text-zinc-500 uppercase font-bold mb-4 tracking-wider">My Groups</h3>
            <div className="space-y-1">
              {groups.length === 0 ? (
                <p className="text-zinc-600 text-xs italic">No groups yet. Create one or join below!</p>
              ) : (
                groups.map(group => (
                  <div 
                    key={group.id}
                    onClick={() => setSelectedGroup(group)}
                    className="flex items-center gap-4 p-3 hover:bg-[#202c33] rounded-xl cursor-pointer transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                      <Users className="w-6 h-6 text-zinc-600" />
                    </div>
                    <div className="flex-1 border-b border-zinc-800/50 pb-3">
                      <div className="flex justify-between items-center">
                        <h4 className="font-bold text-zinc-100">{group.name}</h4>
                        <span className="text-[10px] text-zinc-500">
                          {group.createdAt?.toDate ? new Date(group.createdAt.toDate()).toLocaleDateString() : ''}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 truncate">{group.description || "No description"}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <h3 className="text-[10px] text-zinc-500 uppercase font-bold mt-8 mb-4 tracking-wider">Discover Groups</h3>
            <div className="space-y-1">
              {allGroups.filter(g => !g.members.includes(user.uid)).map(group => (
                <div 
                  key={group.id}
                  className="flex items-center gap-4 p-3 hover:bg-[#202c33] rounded-xl transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center">
                    <Users className="w-6 h-6 text-zinc-700" />
                  </div>
                  <div className="flex-1 flex items-center justify-between border-b border-zinc-800/50 pb-3">
                    <div>
                      <h4 className="font-bold text-zinc-100">{group.name}</h4>
                      <p className="text-xs text-zinc-500">{group.members.length} members</p>
                    </div>
                    <button 
                      onClick={() => joinGroup(group.id)}
                      className="px-4 py-1.5 bg-[#00a884]/10 text-[#00a884] rounded-full text-xs font-bold hover:bg-[#00a884]/20 transition-colors"
                    >
                      Join
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0b141a]">
      <div className="p-4 bg-[#202c33] flex items-center justify-between shadow-md">
        {isSearching ? (
          <div className="flex-1 flex items-center gap-2 bg-[#2a3942] rounded-lg px-3 py-1">
            <button onClick={() => { setIsSearching(false); setSearchQuery(''); }}>
              <Plus className="w-5 h-5 text-zinc-400 rotate-45" />
            </button>
            <input 
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveSearchQuery(searchQuery)}
              placeholder="Search messages..."
              className="flex-1 bg-transparent border-none text-sm focus:outline-none text-zinc-100"
            />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedGroup(null)} className="text-zinc-400 hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 rounded-full bg-zinc-600 flex items-center justify-center overflow-hidden">
                <Users className="w-6 h-6 text-zinc-400" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-100">{selectedGroup.name}</h3>
                {typingUsers.length > 0 ? (
                  <p className="text-[10px] text-emerald-500 animate-pulse">
                    {typingUsers.length === 1 
                      ? `${typingUsers[0].userName} is typing...` 
                      : `${typingUsers.length} people are typing...`}
                  </p>
                ) : (
                  <p className="text-[10px] text-emerald-500">{selectedGroup.members.length} members</p>
                )}
              </div>
            </div>
            <div className="flex gap-4 text-zinc-400">
              <Search className="w-5 h-5 cursor-pointer" onClick={() => setIsSearching(true)} />
              <MoreVertical className="w-5 h-5" />
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat">
        {filteredMessages.map((msg) => (
          <div 
            key={msg.id}
            className={cn(
              "flex flex-col max-w-[85%]",
              msg.senderId === user.uid ? "ml-auto items-end" : "items-start"
            )}
          >
            <div className={cn(
              "p-2 px-3 rounded-lg text-sm shadow-sm relative",
              msg.senderId === user.uid 
                ? "bg-[#005c4b] text-white rounded-tr-none" 
                : "bg-[#202c33] text-zinc-100 rounded-tl-none"
            )}>
              {msg.text}
              <div className="text-[9px] text-zinc-400 text-right mt-1">
                {msg.timestamp?.toDate ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </div>
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      <form onSubmit={sendMessage} className="p-2 bg-[#202c33] flex gap-2 items-center">
        <div className="flex-1 bg-[#2a3942] rounded-full px-4 py-2 flex items-center gap-2">
          <Plus className="w-5 h-5 text-zinc-400" />
          <input 
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            placeholder="Type a message"
            className="flex-1 bg-transparent border-none text-sm focus:outline-none text-zinc-100"
          />
        </div>
        <button type="submit" className="w-12 h-12 bg-[#00a884] rounded-full flex items-center justify-center text-white shadow-lg">
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};

const SocialView = ({ user }: { user: FirebaseUser }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const p = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      setPosts(p);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'users'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const p = snapshot.docs.map(doc => doc.data() as UserProfile);
      setProfiles(p);
    });
    return unsubscribe;
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePost = async () => {
    if (!newPost.trim() && !imageFile) return;
    setUploading(true);
    try {
      let imageUrl = '';
      if (imageFile) {
        imageUrl = await uploadToServer(imageFile) || '';
      }

      await addDoc(collection(db, 'posts'), {
        authorId: user.uid,
        authorName: user.displayName,
        authorPhoto: user.photoURL,
        content: newPost,
        imageUrl,
        likes: 0,
        createdAt: serverTimestamp(),
      });
      setNewPost('');
      setImageFile(null);
      setImagePreview(null);
      toast.success('Status updated!');
    } catch (error) {
      toast.error('Failed to post');
    } finally {
      setUploading(false);
    }
  };

  const filteredPosts = posts.filter(post => 
    post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.authorName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full bg-[var(--bg-app)] flex flex-col overflow-hidden">
      <div className="p-4 bg-[var(--bg-header)] shadow-md z-30 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Updates</h2>
          <div className="flex gap-4 text-[var(--text-secondary)]">
            <Camera className="w-5 h-5 cursor-pointer" onClick={() => fileInputRef.current?.click()} />
            <MoreVertical className="w-5 h-5" />
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search updates..."
            className="w-full bg-[var(--bg-input)] rounded-full py-2 pl-10 pr-4 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleImageChange} 
      />

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="p-4 bg-[var(--bg-app)] border-b border-[var(--border-color)]">
          <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Status</h3>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            <div className="flex flex-col items-center gap-1 min-w-[70px]">
              <div className="w-14 h-14 rounded-full border-2 border-[var(--border-color)] p-0.5 relative">
                <img src={user.photoURL!} className="w-full h-full rounded-full object-cover" alt="My status" />
                <div className="absolute bottom-0 right-0 bg-[var(--accent)] rounded-full p-0.5 border-2 border-[var(--bg-app)]">
                  <Plus className="w-3 h-3 text-white" />
                </div>
              </div>
              <span className="text-[10px] text-[var(--text-secondary)]">My status</span>
            </div>
            {profiles.map((p) => (
              <div key={p.uid} className="flex flex-col items-center gap-1 min-w-[70px]">
                <div className="w-14 h-14 rounded-full border-2 border-[var(--accent)] p-0.5">
                  <img 
                    src={p.photoURL || `https://picsum.photos/seed/${p.uid}/100/100`} 
                    className="w-full h-full rounded-full object-cover" 
                    alt={p.displayName} 
                    referrerPolicy="no-referrer"
                  />
                </div>
                <span className="text-[10px] text-[var(--text-secondary)] truncate w-14 text-center">{p.displayName.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-[var(--bg-card)] rounded-2xl p-4 shadow-sm border border-[var(--border-color)]">
            <textarea 
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="Share an update..."
              className="w-full bg-transparent border-none outline-none resize-none text-sm h-16 text-[var(--text-primary)]"
            />
            
            {imagePreview && (
              <div className="relative mt-2 rounded-xl overflow-hidden border border-[var(--border-color)]">
                <img src={imagePreview} className="w-full max-h-60 object-cover" alt="Preview" />
                <button 
                  onClick={() => { setImageFile(null); setImagePreview(null); }}
                  className="absolute top-2 right-2 bg-black/50 p-1 rounded-full text-white hover:bg-black/70"
                >
                  <Plus className="w-4 h-4 rotate-45" />
                </button>
              </div>
            )}

            <div className="flex justify-between items-center mt-2">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
              >
                <Camera className="w-5 h-5" />
              </button>
              <button 
                onClick={handlePost}
                disabled={uploading}
                className="px-6 py-2 bg-[var(--accent)] text-white rounded-full text-xs font-bold hover:brightness-110 transition-all disabled:opacity-50 shadow-lg shadow-[var(--accent)]/20"
              >
                {uploading ? 'Uploading...' : 'Update'}
              </button>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-5 flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-1 bg-emerald-500 text-[8px] text-white font-bold uppercase tracking-tighter rounded-bl-lg">Sponsored</div>
            <div className="w-14 h-14 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
              <Flame className="w-8 h-8 fill-white" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-[var(--text-primary)]">Heart Premium</h4>
              <p className="text-[11px] text-[var(--text-secondary)] leading-tight">Unlock exclusive matches, ad-free experience, and custom themes!</p>
            </div>
            <button className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-bold shadow-md hover:brightness-110 transition-all">Upgrade</button>
          </div>

          {filteredPosts.map((post) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={post.id} 
              className="bg-[var(--bg-card)] rounded-2xl p-4 shadow-sm border border-[var(--border-color)] space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--bg-input)] flex items-center justify-center overflow-hidden">
                  <img src={post.authorPhoto || `https://picsum.photos/seed/${post.authorId}/100/100`} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[var(--text-primary)]">{post.authorName}</h4>
                  <p className="text-[10px] text-[var(--text-secondary)]">
                    {post.createdAt?.toDate ? new Date(post.createdAt.toDate()).toLocaleDateString() : 'Just now'}
                  </p>
                </div>
              </div>
              <p className="text-sm text-[var(--text-primary)] leading-relaxed">{post.content}</p>
              
              {post.imageUrl && (
                <div className="rounded-xl overflow-hidden border border-[var(--border-color)]">
                  <img src={post.imageUrl} className="w-full max-h-96 object-cover" alt="Post content" referrerPolicy="no-referrer" />
                </div>
              )}
              <div className="flex items-center gap-6 pt-3 border-t border-[var(--border-color)]">
                <button 
                  onClick={() => updateDoc(doc(db, 'posts', post.id), { likes: increment(1) })}
                  className="flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-rose-500 transition-colors"
                >
                  <Heart className="w-4 h-4" />
                  <span className="text-xs font-medium">{post.likes}</span>
                </button>
                <button className="flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-xs font-medium">Reply</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

const MatchView = ({ user, profile }: { user: FirebaseUser, profile: UserProfile }) => {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    const configRef = doc(db, 'config', 'global');
    getDoc(configRef).then(snap => {
      if (snap.exists()) setConfig(snap.data() as AppConfig);
    });
  }, []);

  useEffect(() => {
    if (!profile.isPremium) return;

    const q = query(
      collection(db, 'users'), 
      where('country', '==', profile.country || ''),
      where('city', '==', profile.city || ''),
      limit(50)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const p = snapshot.docs
        .map(doc => doc.data() as UserProfile)
        .filter(p => p.uid !== user.uid)
        .filter(p => {
          if (!profile.gender || !p.gender) return true;
          if (profile.gender === 'male') return p.gender === 'female';
          if (profile.gender === 'female') return p.gender === 'male';
          return true;
        });
      setProfiles(p);
    });
    return unsubscribe;
  }, [profile, user.uid]);

  const handleSwipe = (direction: 'left' | 'right') => {
    if (direction === 'right') {
      toast.success("It's a match!");
    }
    setCurrentIndex(prev => prev + 1);
  };

  const handleUpgradeRequest = async () => {
    try {
      await addDoc(collection(db, 'paymentRequests'), {
        userId: user.uid,
        userName: profile.displayName,
        amount: config?.proPrice || 10,
        status: 'pending',
        timestamp: serverTimestamp()
      });
      toast.success('Upgrade request sent! Admin will verify your payment.');
    } catch (error) {
      toast.error('Failed to send request');
    }
  };

  if (!profile.isPremium) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6 bg-[var(--bg-app)]">
        <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center">
          <Flame className="w-12 h-12 text-emerald-500 fill-emerald-500" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-bold">Premium Match</h3>
          <p className="text-[var(--text-secondary)] text-sm">
            Upgrade to Pro to see matches in {profile.city || 'your city'} and start chatting!
          </p>
        </div>
        
        <div className="bg-[var(--bg-card)] p-6 rounded-2xl border border-[var(--border-color)] w-full space-y-4">
          <div className="flex justify-between items-center">
            <span className="font-bold">Pro Membership</span>
            <span className="text-emerald-500 font-bold text-xl">${config?.proPrice || 10}</span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] text-left">
            {config?.manualPaymentInfo || 'Please contact admin for payment details.'}
          </p>
          <button 
            onClick={handleUpgradeRequest}
            className="w-full py-3 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20"
          >
            I have paid, Upgrade me
          </button>
        </div>
      </div>
    );
  }

  if (currentIndex >= profiles.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4 bg-[var(--bg-app)]">
        <div className="w-20 h-20 bg-[var(--bg-card)] rounded-full flex items-center justify-center border border-[var(--border-color)]">
          <Users className="w-10 h-10 text-[var(--text-secondary)]" />
        </div>
        <h3 className="text-xl font-bold">No more profiles</h3>
        <p className="text-[var(--text-secondary)] text-sm">Check back later for new people in {profile.city}.</p>
      </div>
    );
  }

  const currentProfile = profiles[currentIndex];

  return (
    <div className="h-full bg-[var(--bg-app)] p-4 flex flex-col">
      <div className="flex-1 relative">
        <AnimatePresence mode="wait">
          <motion.div 
            key={currentProfile.uid}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="absolute inset-0 bg-[var(--bg-card)] rounded-3xl overflow-hidden border border-[var(--border-color)] shadow-2xl"
          >
            <div className="h-full relative">
              <img 
                src={currentProfile.photoURL || `https://picsum.photos/seed/${currentProfile.uid}/800/1200`} 
                className="w-full h-full object-cover"
                alt={currentProfile.displayName}
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 p-6 text-white w-full">
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-bold">{currentProfile.displayName}</h3>
                  {currentProfile.isPremium && <Flame className="w-5 h-5 text-emerald-500 fill-emerald-500" />}
                </div>
                <p className="text-sm opacity-80">{currentProfile.city}, {currentProfile.country}</p>
                <p className="text-xs mt-2 line-clamp-2 opacity-60">{currentProfile.bio || "No bio yet"}</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex justify-center gap-6 py-6">
        <button 
          onClick={() => handleSwipe('left')}
          className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center text-rose-500 border border-zinc-800 shadow-xl hover:scale-110 transition-transform"
        >
          <Plus className="w-8 h-8 rotate-45" />
        </button>
        <button 
          onClick={() => handleSwipe('right')}
          className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-xl shadow-emerald-500/20 hover:scale-110 transition-transform"
        >
          <Heart className="w-8 h-8 fill-white" />
        </button>
      </div>
    </div>
  );
};

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-all duration-300",
        active ? "text-emerald-500 scale-110" : "text-zinc-500 hover:text-zinc-300"
      )}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
      {active && (
        <motion.div 
          layoutId="nav-indicator"
          className="w-1 h-1 bg-emerald-500 rounded-full mt-1"
        />
      )}
    </button>
  );
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'social' | 'match' | 'profile' | 'admin'>('chat');
  const [editingBio, setEditingBio] = useState(false);
  const [newBio, setNewBio] = useState('');
  const [newAge, setNewAge] = useState<number | ''>('');
  const [newCountry, setNewCountry] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newGender, setNewGender] = useState<'male' | 'female' | 'other'>('other');
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const profileFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        const userRef = doc(db, 'users', u.uid);
        return onSnapshot(userRef, (doc) => {
          if (doc.exists()) {
            const data = doc.data() as UserProfile;
            setProfile(data);
            setNewBio(data.bio || '');
            setNewAge(data.age || '');
            setNewCountry(data.country || '');
            setNewCity(data.city || '');
            setNewGender(data.gender || 'other');
          }
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user && profile) {
      setLoading(false);
    } else if (!user) {
      setLoading(false);
    }
  }, [user, profile]);

  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsUploadingProfile(true);
    try {
      let photoURL = profile?.photoURL;
      if (profileImageFile) {
        const uploadedUrl = await uploadToServer(profileImageFile);
        if (uploadedUrl) photoURL = uploadedUrl;
      }

      await updateDoc(doc(db, 'users', user.uid), {
        bio: newBio,
        age: newAge === '' ? null : Number(newAge),
        country: newCountry,
        city: newCity,
        gender: newGender,
        photoURL
      });
      setEditingBio(false);
      setProfileImageFile(null);
      setProfileImagePreview(null);
      toast.success('Profile updated!');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setIsUploadingProfile(false);
    }
  };

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-12 h-12 bg-emerald-500 rounded-2xl"
        />
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-app)] text-[var(--text-primary)] transition-colors duration-300">
      <Toaster position="top-center" theme={isDark ? "dark" : "light"} />
      
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'chat' && profile && <ChatView user={user} profile={profile} />}
        {activeTab === 'social' && <SocialView user={user} />}
        {activeTab === 'match' && profile && <MatchView user={user} profile={profile} />}
        {activeTab === 'admin' && profile?.role === 'admin' && <AdminDashboard user={user} />}
        {activeTab === 'profile' && profile && (
          <div className="p-8 space-y-8 overflow-y-auto h-full pb-24">
            <div className="flex justify-end">
              <button 
                onClick={() => setIsDark(!isDark)}
                className="p-3 bg-[var(--bg-input)] rounded-full text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all shadow-sm"
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
            <div className="text-center space-y-4">
              <div className="relative inline-block">
                <img 
                  src={profileImagePreview || profile.photoURL} 
                  className="w-32 h-32 rounded-full mx-auto border-4 border-[var(--accent)] p-1 object-cover" 
                  alt="Profile" 
                />
                <button 
                  onClick={() => profileFileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2 bg-[var(--accent)] rounded-full border-4 border-[var(--bg-app)] hover:scale-110 transition-transform"
                >
                  <Camera className="w-4 h-4 text-white" />
                </button>
                <input 
                  type="file"
                  ref={profileFileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleProfileImageChange}
                />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{profile.displayName}</h2>
                <p className="text-[var(--text-secondary)] text-sm">{profile.email}</p>
              </div>

              <div className="bg-[var(--bg-card)] p-4 rounded-2xl border border-[var(--border-color)] text-left space-y-2 shadow-sm">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">Profile Info</h4>
                  <button 
                    onClick={() => editingBio ? handleUpdateProfile() : setEditingBio(true)}
                    disabled={isUploadingProfile}
                    className="text-[10px] text-[var(--accent)] font-bold uppercase hover:underline disabled:opacity-50"
                  >
                    {isUploadingProfile ? 'Saving...' : (editingBio ? 'Save' : 'Edit')}
                  </button>
                </div>
                {editingBio ? (
                  <div className="space-y-3">
                    <textarea 
                      value={newBio}
                      onChange={(e) => setNewBio(e.target.value)}
                      className="w-full bg-[var(--bg-input)] border-none rounded-lg p-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)] text-[var(--text-primary)]"
                      rows={3}
                      placeholder="Bio"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        type="number"
                        value={newAge}
                        onChange={(e) => setNewAge(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Age"
                        className="bg-[var(--bg-input)] rounded-lg p-2 text-sm outline-none"
                      />
                      <select 
                        value={newGender}
                        onChange={(e) => setNewGender(e.target.value as any)}
                        className="bg-[var(--bg-input)] rounded-lg p-2 text-sm outline-none"
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        value={newCountry}
                        onChange={(e) => setNewCountry(e.target.value)}
                        placeholder="Country"
                        className="bg-[var(--bg-input)] rounded-lg p-2 text-sm outline-none"
                      />
                      <input 
                        value={newCity}
                        onChange={(e) => setNewCity(e.target.value)}
                        placeholder="City"
                        className="bg-[var(--bg-input)] rounded-lg p-2 text-sm outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-[var(--text-secondary)] italic">
                      {profile.bio || "No bio yet. Add one to tell people about yourself!"}
                    </p>
                    <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase text-[var(--accent)]">
                      <span>{profile.age ? `${profile.age} years` : 'Age not set'}</span>
                      <span>•</span>
                      <span>{profile.gender || 'Not set'}</span>
                      <span>•</span>
                      <span>{profile.city || 'City not set'}, {profile.country || 'Country not set'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[var(--bg-card)] p-4 rounded-2xl border border-[var(--border-color)] text-center shadow-sm">
                <p className="text-2xl font-bold">12</p>
                <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest">Matches</p>
              </div>
              <div className="bg-[var(--bg-card)] p-4 rounded-2xl border border-[var(--border-color)] text-center shadow-sm">
                <p className="text-2xl font-bold">1.2k</p>
                <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest">Followers</p>
              </div>
            </div>

            <div className="space-y-2">
              {profile.role === 'admin' && (
                <button 
                  onClick={() => setActiveTab('admin')}
                  className="w-full p-4 bg-emerald-500/10 text-emerald-500 rounded-2xl border border-emerald-500/20 flex items-center gap-3 hover:bg-emerald-500/20 transition-colors shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5" />
                    <span className="text-sm font-medium">Admin Dashboard</span>
                  </div>
                  <Plus className="w-4 h-4" />
                </button>
              )}
              <button className="w-full p-4 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] flex items-center justify-between hover:bg-[var(--bg-input)] transition-colors shadow-sm">
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-[var(--text-secondary)]" />
                  <span className="text-sm font-medium">Settings</span>
                </div>
                <Plus className="w-4 h-4 text-[var(--text-secondary)]" />
              </button>
              <button className="w-full p-4 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] flex items-center justify-between hover:bg-[var(--bg-input)] transition-colors shadow-sm">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-[var(--text-secondary)]" />
                  <span className="text-sm font-medium">Notifications</span>
                </div>
                <div className="w-2 h-2 bg-[var(--accent)] rounded-full" />
              </button>
              <button 
                onClick={() => signOut(auth)}
                className="w-full p-4 bg-rose-500/10 text-rose-500 rounded-2xl border border-rose-500/20 flex items-center justify-center gap-2 font-bold mt-8"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>

      <nav className="h-20 bg-[var(--bg-header)] border-t border-[var(--border-color)] flex items-center justify-around px-6 sticky bottom-0 z-50">
        <NavButton 
          active={activeTab === 'chat'} 
          onClick={() => setActiveTab('chat')}
          icon={<MessageCircle className="w-6 h-6" />}
          label="Chats"
        />
        <NavButton 
          active={activeTab === 'social'} 
          onClick={() => setActiveTab('social')}
          icon={<Users className="w-6 h-6" />}
          label="Updates"
        />
        <NavButton 
          active={activeTab === 'match'} 
          onClick={() => setActiveTab('match')}
          icon={<Heart className="w-6 h-6" />}
          label="Match"
        />
        <NavButton 
          active={activeTab === 'profile'} 
          onClick={() => setActiveTab('profile')}
          icon={<UserIcon className="w-6 h-6" />}
          label="Profile"
        />
        {profile?.role === 'admin' && (
          <NavButton 
            active={activeTab === 'admin'} 
            onClick={() => setActiveTab('admin')}
            icon={<Shield className="w-6 h-6" />}
            label="Admin"
          />
        )}
      </nav>
    </div>
  );
}
