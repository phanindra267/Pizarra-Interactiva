const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'src', 'pages', 'Whiteboard.jsx');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Add Lucide imports
const importLucide = "import { Pencil, Brush, Eraser, Minus, Square, Circle, Type, StickyNote, Image as ImageIcon, Undo2, Redo2, Trash2, Video, VideoOff, Camera, Download, Link as LinkIcon, Sparkles, MessageSquare, ZoomIn, ZoomOut, Maximize, UserPlus, Users, Folder, Clock, Check, X, Lock, Unlock, PenOff, PenTool } from 'lucide-react';\n";
content = content.replace("import ExportOverlay from '../components/ExportOverlay';", "import ExportOverlay from '../components/ExportOverlay';\n" + importLucide);

// 2. Replace TOOLS array
const oldTools = `const TOOLS = [
    { id: 'pencil', icon: '✏️', label: 'Pencil' },
    { id: 'brush', icon: '🖌️', label: 'Brush' },
    { id: 'eraser', icon: '🧹', label: 'Eraser' },
    { id: 'line', icon: '📏', label: 'Line' },
    { id: 'rect', icon: '⬜', label: 'Rectangle' },
    { id: 'circle', icon: '⭕', label: 'Circle' },
    { id: 'text', icon: '📝', label: 'Text' },
    { id: 'sticky', icon: '📌', label: 'Sticky Note' },
    { id: 'image', icon: '🖼️', label: 'Image' }
];`;

const newTools = `const TOOLS = [
    { id: 'pencil', icon: <Pencil size={20} />, label: 'Pencil' },
    { id: 'brush', icon: <Brush size={20} />, label: 'Brush' },
    { id: 'eraser', icon: <Eraser size={20} />, label: 'Eraser' },
    { id: 'line', icon: <Minus size={20} />, label: 'Line' },
    { id: 'rect', icon: <Square size={20} />, label: 'Rectangle' },
    { id: 'circle', icon: <Circle size={20} />, label: 'Circle' },
    { id: 'text', icon: <Type size={20} />, label: 'Text' },
    { id: 'sticky', icon: <StickyNote size={20} />, label: 'Sticky Note' },
    { id: 'image', icon: <ImageIcon size={20} />, label: 'Image' }
];`;
content = content.replace(oldTools, newTools);

// 3. Replace various emojis in UI
content = content.replace(/'🔗 Share'/g, "'Share'");
content = content.replace(/>🔗 Share</g, "><LinkIcon size={16} /> Share<");
content = content.replace(/>💾 Export</g, "><Download size={16} /> Export<");
content = content.replace(/>✨ AI Generate</g, "><Sparkles size={16} /> AI Generate<");
content = content.replace(/>💬 Chat</g, "><MessageSquare size={16} /> Chat<");

content = content.replace(/>↩️</g, "><Undo2 size={20} /><");
content = content.replace(/>↪️</g, "><Redo2 size={20} /><");
content = content.replace(/>🗑️</g, "><Trash2 size={20} /><");

content = content.replace(/{localStream \? '📹' : '📽️'}/g, "{localStream ? <VideoOff size={20} /> : <Video size={20} />}");

content = content.replace(/>#️⃣ Grid</g, ">Grid<");

content = content.replace(/>💬</g, "><MessageSquare size={20} /><");
content = content.replace(/>👥</g, "><Users size={20} /><");
content = content.replace(/>📁</g, "><Folder size={20} /><");
content = content.replace(/>🕐</g, "><Clock size={20} /><");

content = content.replace(/>✕</g, "><X size={20} /><");

content = content.replace(/>🔒</g, "><Lock size={16} /><");
content = content.replace(/>🔓</g, "><Unlock size={16} /><");
content = content.replace(/>✏️</g, "><PenTool size={16} /><");
content = content.replace(/>🚫</g, "><PenOff size={16} /><");
content = content.replace(/>👢</g, "><UserPlus size={16} /><"); // generic kick icon fallback
content = content.replace(/>🖼️/g, "><ImageIcon size={16} /><");
content = content.replace(/>📄/g, "><File size={16} /><");

content = content.replace(/>📸 /g, "><Camera size={16} style={{marginRight: 6}} /> ");
content = content.replace(/>✨ /g, "><Sparkles size={24} style={{marginRight: 8}} /> ");

fs.writeFileSync(targetFile, content);
console.log('Replaced emojis with Lucide icons.');
