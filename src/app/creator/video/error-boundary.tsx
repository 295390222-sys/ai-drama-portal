"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: "" };
  }

  static getDerivedStateFromError(e: Error): State {
    return { hasError: true, error: e.message || "未知错误" };
  }

  componentDidCatch(error: Error, info: any) {
    console.error("VideoPage Error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-black flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-lg font-bold text-white mb-2">页面出错了</h2>
            <p className="text-sm text-zinc-400 mb-4 whitespace-pre-wrap">
              {this.state.error}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: "" });
                window.location.href = "/creator/video/index.html";
              }}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white"
            >
              重新加载
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
