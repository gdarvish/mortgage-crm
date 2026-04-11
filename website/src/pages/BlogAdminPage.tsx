import { useState, useEffect } from "react";
import SEOHead from "../components/seo/SEOHead";
import { loadPosts, savePosts, type BlogPost } from "../data/blogPosts";

const ADMIN_PASSWORD = "Gabid@1980";

export default function BlogAdminPage() {
  const [isAuth, setIsAuth] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState(false);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", excerpt: "", content: "", category: "", imageUrl: "", author: "הצוות הכלכלי" });

  useEffect(() => {
    if (isAuth) setPosts(loadPosts());
  }, [isAuth]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuth(true);
      setAuthError(false);
    } else {
      setAuthError(true);
    }
  };

  const resetForm = () => {
    setForm({ title: "", excerpt: "", content: "", category: "", imageUrl: "", author: "הצוות הכלכלי" });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    let updated: BlogPost[];
    if (editingId) {
      updated = posts.map((p) =>
        p.id === editingId ? { ...p, ...form, date: p.date } : p
      );
    } else {
      const newPost: BlogPost = {
        id: Date.now().toString(),
        ...form,
        authorRole: "",
        date: new Date().toISOString().slice(0, 10),
      };
      updated = [newPost, ...posts];
    }
    setPosts(updated);
    savePosts(updated);
    resetForm();
  };

  const handleDelete = (id: string) => {
    const updated = posts.filter((p) => p.id !== id);
    setPosts(updated);
    savePosts(updated);
  };

  const handleEdit = (post: BlogPost) => {
    setForm({ title: post.title, excerpt: post.excerpt, content: post.content, category: post.category, imageUrl: post.imageUrl, author: post.author });
    setEditingId(post.id);
    setShowForm(true);
  };

  const toggleFeatured = (id: string) => {
    const updated = posts.map((p) => ({ ...p, featured: p.id === id ? !p.featured : false }));
    setPosts(updated);
    savePosts(updated);
  };

  if (!isAuth) {
    return (
      <>
        <SEOHead title="ניהול בלוג | הבית הכלכלי" description="" />
        <div className="min-h-screen bg-surface flex items-center justify-center px-4">
          <div className="bg-surface-container-lowest rounded-2xl p-8 editorial-shadow max-w-sm w-full">
            <div className="text-center mb-6">
              <span className="material-symbols-outlined text-primary text-4xl mb-2 block">admin_panel_settings</span>
              <h1 className="font-headline text-2xl font-bold text-primary">ניהול בלוג</h1>
              <p className="text-on-surface-variant text-sm mt-1">הזינו סיסמה כדי להיכנס</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setAuthError(false); }}
                className="editorial-input w-full py-3 text-center text-lg"
                placeholder="סיסמה"
                autoFocus
              />
              {authError && <p className="text-error text-xs text-center">סיסמה שגויה</p>}
              <button type="submit" className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:opacity-90 transition-opacity">כניסה</button>
            </form>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead title="ניהול בלוג | הבית הכלכלי" description="" />
      <div className="min-h-screen bg-surface pt-24 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div>
              <h1 className="font-headline text-2xl font-bold text-primary">ניהול תכני הבלוג</h1>
              <p className="text-on-surface-variant text-sm">{posts.length} מאמרים</p>
            </div>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:opacity-90 transition-all"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              מאמר חדש
            </button>
          </div>

          {/* Create/Edit Form */}
          {showForm && (
            <div className="bg-surface-container-lowest rounded-xl p-6 editorial-shadow mb-8">
              <h2 className="font-headline text-lg font-bold text-primary mb-4">
                {editingId ? "עריכת מאמר" : "מאמר חדש"}
              </h2>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1">כותרת *</label>
                    <input type="text" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="editorial-input w-full py-2 text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1">קטגוריה</label>
                    <input type="text" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className="editorial-input w-full py-2 text-sm" placeholder="כלכלה, נדלן..." />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">תקציר</label>
                  <input type="text" value={form.excerpt} onChange={(e) => setForm((p) => ({ ...p, excerpt: e.target.value }))} className="editorial-input w-full py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">תוכן</label>
                  <textarea value={form.content} onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))} className="editorial-input w-full py-2 text-sm min-h-[120px] resize-y" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1">קישור לתמונה</label>
                    <input type="url" value={form.imageUrl} onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))} className="editorial-input w-full py-2 text-sm" placeholder="https://..." />
                  </div>
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1">מחבר</label>
                    <input type="text" value={form.author} onChange={(e) => setForm((p) => ({ ...p, author: e.target.value }))} className="editorial-input w-full py-2 text-sm" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:opacity-90 transition-all">
                    {editingId ? "עדכון" : "פרסום"}
                  </button>
                  <button type="button" onClick={resetForm} className="px-6 py-2 bg-surface-container text-on-surface-variant rounded-lg font-medium hover:bg-surface-container-high transition-all">
                    ביטול
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Posts List */}
          <div className="space-y-4">
            {posts.map((post) => (
              <div key={post.id} className="bg-surface-container-lowest rounded-xl p-4 editorial-shadow flex items-center gap-4">
                {/* Thumbnail */}
                {post.imageUrl && (
                  <div className="w-20 h-14 rounded-lg overflow-hidden flex-shrink-0 hidden sm:block">
                    <img src={post.imageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-headline text-sm font-bold text-primary truncate">{post.title}</h3>
                    {post.featured && (
                      <span className="px-2 py-0.5 bg-brand-gold/10 text-brand-gold text-[10px] font-bold rounded-full flex-shrink-0">מומלץ</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                    <span>{post.category}</span>
                    <span>{post.date}</span>
                    <span>{post.author}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => toggleFeatured(post.id)} title="סמן כמומלץ" className="p-2 rounded-lg hover:bg-surface-container-high transition-colors">
                    <span className={`material-symbols-outlined text-lg ${post.featured ? "text-brand-gold" : "text-on-surface-variant/50"}`} style={post.featured ? { fontVariationSettings: "'FILL' 1" } : {}}>star</span>
                  </button>
                  <button onClick={() => handleEdit(post)} title="ערוך" className="p-2 rounded-lg hover:bg-surface-container-high transition-colors">
                    <span className="material-symbols-outlined text-lg text-on-surface-variant">edit</span>
                  </button>
                  <button onClick={() => handleDelete(post.id)} title="מחק" className="p-2 rounded-lg hover:bg-error-container transition-colors">
                    <span className="material-symbols-outlined text-lg text-error">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
