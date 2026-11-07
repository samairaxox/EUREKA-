import { Component } from 'react';

/**
 * Wraps a WebGL or canvas effect. If the effect throws (for example, WebGL is unavailable),
 * the fallback is rendered instead, so the page content is never lost.
 */
export default class SafeEffect extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Visual effect unavailable, showing static fallback:', error);
    }
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
