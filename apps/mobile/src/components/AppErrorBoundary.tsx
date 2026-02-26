import React, { ReactNode } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  // m-5: Add errorInfo parameter to log component stack
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Unhandled app error', error, errorInfo.componentStack);
  }

  private reset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>{this.state.message || 'Unexpected app error.'}</Text>
          <Button title="Retry" onPress={this.reset} />
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f6f9fc'
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#102a43',
    marginBottom: 8
  },
  subtitle: {
    color: '#486581',
    marginBottom: 16,
    textAlign: 'center'
  }
});
