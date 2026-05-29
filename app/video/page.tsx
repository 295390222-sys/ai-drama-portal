export default function VideoPage() {
  return (
    <div style={{ background: "#000", color: "#fff", minHeight: "100vh", fontFamily: "sans-serif" }}>
      
      {/* header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: "1px solid #222",
        fontSize: 14
      }}>
        <a href="/" style={{ color: "#888", textDecoration: "none" }}>← 返回</a>
        <div>🎬 视频生成</div>
        <div style={{ width: 40 }} />
      </div>

      {/* content */}
      <div style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>
        
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 12, marginBottom: 12, fontSize: 12, color: "#888" }}>
          🎬 创作流程：
          <ol style={{ paddingLeft: 18 }}>
            <li>输入剧本 → AI解析</li>
            <li>角色匹配</li>
            <li>分镜生成</li>
            <li>视频生成</li>
          </ol>
        </div>

        <textarea
          placeholder="输入剧本..."
          style={{
            width: "100%",
            minHeight: 100,
            background: "#1a1a1a",
            color: "#fff",
            border: "1px solid #333",
            borderRadius: 8,
            padding: 10
          }}
        />

        <button style={{
          width: "100%",
          marginTop: 12,
          padding: 14,
          background: "linear-gradient(135deg,#3b82f6,#7c3aed)",
          border: 0,
          color: "#fff",
          borderRadius: 8,
          fontWeight: 600
        }}>
          🎬 生成视频
        </button>

      </div>
    </div>
  )
}
