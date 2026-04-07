'use client';

import { useEffect, useState } from 'react';

interface Video {
  id: string;
  title: string;
  url?: string;
  description?: string;
  category?: string;
  duration?: string;
  active?: boolean;
  createdAt?: string;
}

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    title: '', url: '', description: '', category: '', duration: '',
  });

  function loadVideos() {
    setLoading(true);
    fetch('/api/videos')
      .then(r => r.ok ? r.json() : [])
      .then(d => setVideos(Array.isArray(d) ? d : (d.videos ?? [])))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadVideos(); }, []);

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError('');
    try {
      const r = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          url: form.url || undefined,
          description: form.description || undefined,
          category: form.category || undefined,
          duration: form.duration || undefined,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to add video');
      setSuccess('Video added successfully!');
      setForm({ title: '', url: '', description: '', category: '', duration: '' });
      setShowForm(false);
      loadVideos();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add video');
    } finally {
      setSaving(false);
    }
  }

  const categories = [...new Set(videos.map(v => v.category).filter(Boolean))] as string[];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Video Library</div>
          <div className="page-subtitle">{loading ? 'Loading…' : `${videos.length} video${videos.length !== 1 ? 's' : ''}`}</div>
        </div>
        <button className="btn" onClick={() => setShowForm(v => !v)}>
          {showForm ? '✕ Cancel' : '+ Add Video'}
        </button>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">⚠️ {error} <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', fontSize: 16 }}>✕</button></div>}
        {success && <div className="alert alert-success">✓ {success} <button onClick={() => setSuccess('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#166534', fontSize: 16 }}>✕</button></div>}

        {/* Add Video Form */}
        {showForm && (
          <div className="card mb-6">
            <div className="card-title">Add New Video</div>
            <form onSubmit={handleAdd}>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Title <span className="required">*</span></label>
                  <input type="text" className="form-input" placeholder="Video title" value={form.title} onChange={e => set('title', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <input type="text" className="form-input" placeholder="e.g. Allergy Education" value={form.category} onChange={e => set('category', e.target.value)} />
                </div>
              </div>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Video URL</label>
                  <input type="url" className="form-input" placeholder="https://..." value={form.url} onChange={e => set('url', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Duration</label>
                  <input type="text" className="form-input" placeholder="e.g. 5:30" value={form.duration} onChange={e => set('duration', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input" placeholder="Brief description of this video…" rows={3} value={form.description} onChange={e => set('description', e.target.value)} style={{ resize: 'vertical' }} />
              </div>
              <div className="flex gap-3" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary btn" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn" disabled={saving}>
                  {saving ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Adding…</> : '+ Add Video'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Video List */}
        {loading ? (
          <div className="loading-center"><div className="spinner" /><span>Loading videos…</span></div>
        ) : videos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🎬</div>
            <div className="empty-state-title">No videos yet</div>
            <div>Add instructional videos for patients to watch before testing.</div>
            <div style={{ marginTop: 16 }}>
              <button className="btn" onClick={() => setShowForm(true)}>Add First Video</button>
            </div>
          </div>
        ) : (
          <>
            {(categories.length > 0 ? categories : [undefined]).map(cat => {
              const catVideos = cat ? videos.filter(v => v.category === cat) : videos.filter(v => !v.category);
              if (catVideos.length === 0) return null;
              return (
                <div key={cat ?? 'uncategorized'} className="mb-6">
                  {categories.length > 0 && (
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0055A5', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #e2e8f0' }}>
                      {cat ?? 'Uncategorized'}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                    {catVideos.map(v => (
                      <div key={v.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        {/* Thumbnail placeholder */}
                        <div style={{ background: 'linear-gradient(135deg, #0055A5, #2EC4B6)', height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
                          🎬
                        </div>
                        <div style={{ padding: 16 }}>
                          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: '#1a2233' }}>{v.title}</div>
                          {v.description && <div style={{ fontSize: 13, color: '#64748b', marginBottom: 10, lineHeight: 1.5 }}>{v.description}</div>}
                          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                            {v.category && <span className="badge badge-blue">{v.category}</span>}
                            {v.duration && <span className="badge badge-gray">⏱ {v.duration}</span>}
                          </div>
                          {v.url && (
                            <div style={{ marginTop: 12 }}>
                              <a
                                href={v.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-sm btn-secondary"
                                style={{ textDecoration: 'none' }}
                              >
                                ▶ Watch Video
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </>
  );
}
