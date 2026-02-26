const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'src', 'pages', 'Whiteboard.jsx');
let content = fs.readFileSync(targetFile, 'utf8');

const returnStatementStart = content.search(/    return \(\r?\n        <div className="whiteboard-page">/);
const returnStatementEnd = content.lastIndexOf('    );');

if (returnStatementStart === -1 || returnStatementEnd === -1) {
    console.error('Could not find the return statement bounds', { returnStatementStart, returnStatementEnd });
    process.exit(1);
}

const newReturnStatement = `    return (
        <div className="whiteboard-page">
            {/* Top Bar */}
            <div className="wb-top-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>Room: {roomInfo?.roomId || roomId}</span>
                    <div className="participant-avatars" style={{ display: 'flex', gap: -8 }}>
                        {participants.slice(0, 3).map(p => (
                           <div key={p.userId} className="avatar" style={{ background: getCursorColor(p.userId || ''), width: 28, height: 28, fontSize: '0.75rem', marginLeft: '-8px', border: '2px solid var(--bg-card)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                               {p.userName?.charAt(0).toUpperCase() || '?'}
                           </div>
                        ))}
                        {participants.length > 3 && <div className="avatar" style={{ width: 28, height: 28, fontSize: '0.75rem', marginLeft: '-8px', border: '2px solid var(--bg-card)', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+{participants.length - 3}</div>}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(window.location.href); alert('Room link copied!'); }}>🔗 Share</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => exportCanvas('png')}>💾 Export</button>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowAIModal(true)}>✨ AI Generate</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setSidebarOpen(!sidebarOpen)}>💬 Chat</button>
                </div>
            </div>

            <div className="wb-main-content">
                {/* Left Sidebar Toolbar */}
                {myRole !== 'observer' && (
                    <div className="wb-left-sidebar">
                        {TOOLS.map(t => (
                            <button key={t.id} className={\`tool-btn \${tool === t.id ? 'active' : ''}\`}
                                onClick={() => setTool(t.id)} title={t.label}>
                                {t.icon}
                            </button>
                        ))}
                        <div style={{ width: 32, height: 1, background: 'var(--border-color)', margin: '8px 0' }} />
                        <button className="tool-btn" onClick={handleUndo} title="Undo">↩️</button>
                        <button className="tool-btn" onClick={handleRedo} title="Redo">↪️</button>
                        {myRole === 'host' && (
                            <button className="tool-btn" onClick={handleClearBoard} title="Clear Board">🗑️</button>
                        )}
                        <button className="tool-btn" onClick={toggleVideo} title={localStream ? 'Stop video' : 'Start video'} style={localStream ? { color: 'var(--accent-primary)' } : {}}>
                            {localStream ? '📹' : '📽️'}
                        </button>
                    </div>
                )}

                {/* Center Canvas */}
                <div className="wb-center-canvas" style={{ backgroundImage: gridEnabled ? 'radial-gradient(circle at 1px 1px, var(--border-color) 1px, transparent 0)' : 'none' }}>
                    <canvas
                        ref={canvasRef}
                        onMouseDown={startDrawing}
                        onMouseMove={handleMouseMove}
                        onMouseUp={endDrawing}
                        onMouseLeave={endDrawing}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={endDrawing}
                        onWheel={handleWheel}
                        style={{ cursor: tool === 'text' || tool === 'sticky' ? 'text' : 'crosshair' }}
                    />
                    
                    {activeEditor && (
                        <div className={\`floating-editor-container \${activeEditor.tool}\`}
                            style={{ left: activeEditor.x * transform.scale + transform.x, top: activeEditor.y * transform.scale + transform.y, transform: \`scale(\${transform.scale})\`, transformOrigin: 'top left' }}>
                            {activeEditor.tool === 'text' ? (
                                <input autoFocus className="text-tool-input" style={{ color, fontSize: brushSize * 5 }} onBlur={(e) => handleEditorSubmit(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleEditorSubmit(e.target.value); if (e.key === 'Escape') setActiveEditor(null); }} />
                            ) : (
                                <textarea autoFocus className="sticky-tool-input" onBlur={(e) => handleEditorSubmit(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setActiveEditor(null); }} />
                            )}
                        </div>
                    )}

                    {Object.entries(remoteCursors).map(([userId, { userName, x, y }]) => (
                        <div key={userId} className="remote-cursor" style={{ transform: \`translate(\${x}px, \${y}px)\` }}>
                            <svg className="cursor-arrow" viewBox="0 0 16 20" fill={getCursorColor(userId)}><path d="M0 0L16 12L8 12L12 20L8 18L4 12L0 16Z" /></svg>
                            <span className="cursor-label" style={{ background: getCursorColor(userId) }}>{userName}</span>
                        </div>
                    ))}

                    <div className="wb-bottom-bar">
                        <button className="btn btn-ghost btn-sm" onClick={() => setTransform({ scale: 1, x: 0, y: 0 })}>Reset Zoom ({(transform.scale * 100).toFixed(0)}%)</button>
                        <button className={\`btn btn-ghost btn-sm \${gridEnabled ? 'active' : ''}\`} onClick={() => setGridEnabled(!gridEnabled)}>
                            #️⃣ Grid
                        </button>
                    </div>

                     <div className="video-grid">
                        {localStream && (
                            <div className="video-item local">
                                <video autoPlay playsInline muted ref={el => { if (el) el.srcObject = localStream; }} />
                                <div className="user-label">You (Camera)</div>
                            </div>
                        )}
                        {screenStream && (
                            <div className="video-item local screen">
                                <video autoPlay playsInline muted ref={el => { if (el) el.srcObject = screenStream; }} />
                                <div className="user-label">You (Screen)</div>
                            </div>
                        )}
                        {Object.entries(remoteStreams).map(([socketId, stream]) => (
                            <RemoteVideo key={socketId} stream={stream} userName={
                                participants.find(p => p.userId === socketId || p.socketId === socketId)?.userName || 'Remote'
                            } />
                        ))}
                    </div>
                </div>

                {/* Right Properties Panel */}
                {myRole !== 'observer' && (
                    <div className="wb-right-panel" style={{ padding: 16 }}>
                        <h4 style={{ marginBottom: 12, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Properties</h4>
                        
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Stroke Color</label>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {['#ffffff', '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#6c5ce7', '#a29bfe', '#fd79a8', '#00cec9', '#fdcb6e', '#2d3436', '#636e72'].map(c => (
                                    <div key={c} onClick={() => setColor(c)} style={{ width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer', border: color === c ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)' }} />
                                ))}
                            </div>
                            <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ marginTop: 8, width: '100%', height: 32, cursor: 'pointer', background: 'transparent', border: 'none' }} />
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Fill Color</label>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <div onClick={() => setFillColor('transparent')} style={{ width: 24, height: 24, borderRadius: '50%', background: 'transparent', cursor: 'pointer', border: fillColor === 'transparent' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>🚫</div>
                                {['#ffffff', '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#6c5ce7', '#a29bfe', '#fd79a8', '#00cec9', '#fdcb6e', '#2d3436', '#636e72'].map(c => (
                                    <div key={c} onClick={() => setFillColor(c)} style={{ width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer', border: fillColor === c ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)' }} />
                                ))}
                            </div>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Stroke Width ({brushSize}px)</label>
                            <input type="range" min="1" max="50" value={brushSize} onChange={e => setBrushSize(+e.target.value)} style={{ width: '100%' }} />
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Opacity ({opacity}%)</label>
                            <input type="range" min="10" max="100" value={opacity} onChange={e => setOpacity(+e.target.value)} style={{ width: '100%' }} />
                        </div>
                    </div>
                )}

                {/* Sidebar (Chat & Participants) - Right side collapse */}
                <div className={\`sidebar \${sidebarOpen ? '' : 'collapsed'}\`} style={{ position: 'absolute', right: 0, height: '100%', zIndex: 100 }}>
                     <div className="sidebar-tabs">
                        <button className={\`sidebar-tab \${sidebarTab === 'chat' ? 'active' : ''}\`} onClick={() => setSidebarTab('chat')}>💬</button>
                        <button className={\`sidebar-tab \${sidebarTab === 'people' ? 'active' : ''}\`} onClick={() => setSidebarTab('people')}>👥</button>
                        <button className={\`sidebar-tab \${sidebarTab === 'files' ? 'active' : ''}\`} onClick={() => setSidebarTab('files')}>📁</button>
                        <button className={\`sidebar-tab \${sidebarTab === 'history' ? 'active' : ''}\`} onClick={() => setSidebarTab('history')}>🕐</button>
                        <button className="sidebar-tab" onClick={() => setSidebarOpen(false)} style={{ color: 'var(--text-muted)' }}>✕</button>
                    </div>

                    <div className="sidebar-content">
                        {/* Chat Tab */}
                        {sidebarTab === 'chat' && (
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                <div className="chat-messages" style={{ flex: 1, overflowY: 'auto' }}>
                                    {messages.map((msg, i) => (
                                        <div key={msg._id || i} className={\`chat-message \${msg.type === 'system' ? 'system' : ''}\`}>
                                            {msg.type === 'system' ? (
                                                <div className="msg-text">{msg.text}</div>
                                            ) : (
                                                <>
                                                    <div className="msg-header">
                                                        <span className="msg-user">{msg.userName}</span>
                                                        <span className="msg-time">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                    <div className="msg-text">{msg.text}</div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                    <div ref={chatEndRef} />
                                </div>
                                {typingUsers.length > 0 && (
                                    <div className="typing-indicator">{typingUsers.join(', ')} typing...</div>
                                )}
                            </div>
                        )}

                        {/* People Tab */}
                        {sidebarTab === 'people' && (
                            <div className="participant-list">
                                <div className="section-header">
                                    <span>{participants.length} online</span>
                                    {myRole === 'host' && (
                                        <div className="host-controls-mini">
                                            <button className={\`btn-icon-sm \${roomInfo?.isLocked ? 'active' : ''}\`} onClick={handleToggleLock} title="Toggle Room Lock">
                                                {roomInfo?.isLocked ? '🔒' : '🔓'}
                                            </button>
                                            <button className={\`btn-icon-sm \${roomInfo?.drawingEnabled ? 'active' : ''}\`} onClick={handleToggleDrawing} title="Toggle Drawing Permissions">
                                                {roomInfo?.drawingEnabled ? '✏️' : '🚫'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {participants.map((p, i) => (
                                    <div key={i} className="participant-item">
                                        <div className="avatar" style={{ background: getCursorColor(p.userId || '') }}>
                                            {p.userName?.charAt(0).toUpperCase() || '?'}
                                        </div>
                                        <div className="info">
                                            <div className="name">{p.userName}{p.userId === user._id ? ' (you)' : ''}</div>
                                            <div className="role">{p.role || 'participant'}</div>
                                        </div>
                                        {myRole === 'host' && p.userId !== user._id && (
                                            <button className="kick-btn" onClick={() => handleKick(p.userId)} title="Kick Participant">👢</button>
                                        )}
                                        <div className="online-dot" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Files Tab */}
                        {sidebarTab === 'files' && (
                            <div>
                                <div className="file-upload-area" onClick={() => fileInputRef.current?.click()}>
                                    <p>📂 Click or drag to upload</p>
                                    <p style={{ fontSize: '0.75rem', marginTop: 4 }}>Images, PDFs up to 10MB</p>
                                </div>
                                <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} accept="image/*,.pdf" />
                                <div className="file-list">
                                    {files.map((f, i) => (
                                        <a key={f._id || i} href={f.url} target="_blank" rel="noopener noreferrer" className="file-item">
                                            <div className="file-icon">{f.mimeType?.startsWith('image') ? '🖼️' : '📄'}</div>
                                            <div className="file-info">
                                                <div className="file-name">{f.originalName || f.filename}</div>
                                                <div className="file-meta">{f.uploaderName} · {f.size ? \`\${(f.size / 1024).toFixed(1)} KB\` : ''}</div>
                                            </div>
                                        </a>
                                    ))}
                                    {files.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>No files shared yet</div>}
                                </div>
                            </div>
                        )}

                        {/* History Tab */}
                        {sidebarTab === 'history' && (
                            <div>
                                <button className="btn btn-secondary btn-sm" onClick={saveVersion} style={{ marginBottom: 16, width: '100%' }}>
                                    📸 Save Current Snapshot
                                </button>
                                <div className="version-list">
                                    {versions.map((v, i) => (
                                        <div key={v._id || i} className="version-item">
                                            <div className="version-info">
                                                <div className="version-label">{v.label || \`Version \${v.versionNumber}\`}</div>
                                                <div className="version-meta">{v.createdBy?.name} · {new Date(v.createdAt).toLocaleString()}</div>
                                            </div>
                                            <button className="btn btn-ghost btn-sm" onClick={() => restoreVersion(v._id)}>Restore</button>
                                        </div>
                                    ))}
                                    {versions.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>No snapshots yet</div>}
                                </div>
                            </div>
                        )}
                    </div>

                    {sidebarTab === 'chat' && (
                        <form className="chat-input-area" onSubmit={sendMessage}>
                            <input className="input" placeholder="Type a message..." value={chatInput} onChange={handleTyping} />
                            <button type="submit" className="btn btn-primary btn-sm">Send</button>
                        </form>
                    )}
                </div>
            </div>

             {/* AI Generate Modal */}
             {showAIModal && (
                <div className="modal-overlay" style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass card" style={{ padding: 24, width: '100%', maxWidth: 500, background: 'var(--bg-card)' }}>
                        <h3 style={{ marginBottom: 16 }}>✨ Generate Diagram with AI</h3>
                        <textarea 
                             className="input" 
                             style={{ width: '100%', height: 100, marginBottom: 16, resize: 'none' }} 
                             placeholder="Describe the diagram you want... (e.g. 'A flow chart for an e-commerce checkout process')"
                             value={aiPrompt}
                             onChange={e => setAiPrompt(e.target.value)}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <button className="btn btn-ghost" onClick={() => setShowAIModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={async () => {
                                setIsGeneratingAI(true);
                                try {
                                    const { data } = await api.post(\`/ai/generate-diagram\`, { prompt: aiPrompt, roomId });
                                    if (data.elements) {
                                        setStrokes(prev => [...prev, ...data.elements]);
                                        emit('draw-batch', { roomId, strokes: data.elements });
                                    }
                                    setShowAIModal(false);
                                    setAiPrompt('');
                                } catch (err) {
                                    alert('AI Generation failed: ' + (err.response?.data?.message || err.message));
                                } finally {
                                    setIsGeneratingAI(false);
                                }
                            }} disabled={isGeneratingAI || !aiPrompt.trim()}>
                                {isGeneratingAI ? 'Generating...' : 'Generate'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <canvas ref={exportCanvasRef} style={{ display: 'none' }} />
            {isExporting && <ExportOverlay progress={exportProgress} total={recording.length} />}
        </div>
`;

content = content.substring(0, returnStatementStart) + newReturnStatement + content.substring(returnStatementEnd);
fs.writeFileSync(targetFile, content);
console.log('Successfully replaced JSX return statement in Whiteboard.jsx');
