import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { Button } from '../../../components/Button';
import { supabase } from '../../../lib/supabase';
import { useEditProfile } from '../../../hooks/useEditProfile';

export function EditProfileScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [timezone, setTimezone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const edit = useEditProfile(session.user.id);

  useEffect(() => {
    supabase
      .from('users')
      .select('display_name, bio, timezone, avatar_url')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setDisplayName(data?.display_name ?? '');
        setBio(data?.bio ?? '');
        setTimezone(data?.timezone ?? '');
        setAvatarUrl(data?.avatar_url ?? '');
      });
  }, [session.user.id]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Button title="Back" onPress={onBack} tone="secondary" />
      <Text style={styles.title}>Edit Profile</Text>

      <Field label="Display Name" value={displayName} onChange={setDisplayName} />
      <Field label="Bio" value={bio} onChange={setBio} multiline />
      <Field label="Timezone" value={timezone} onChange={setTimezone} />
      <Field label="Avatar URL" value={avatarUrl} onChange={setAvatarUrl} autoCapitalize="none" />

      <Button
        title={edit.saving ? 'Saving...' : 'Save'}
        onPress={async () => {
          try {
            await edit.save({
              display_name: displayName,
              bio,
              timezone,
              avatar_url: avatarUrl
            });
            onBack();
          } catch (error) {
            Alert.alert('Save failed', error instanceof Error ? error.message : 'Unknown error');
          }
        }}
      />
    </ScrollView>
  );
}

function Field(props: any) {
  return (
    <>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput {...props} style={[styles.input, props.multiline ? styles.textarea : null]} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },
  content: { padding: 16 },
  title: { color: '#102a43', fontSize: 24, fontWeight: '800', marginTop: 8 },
  label: { color: '#334e68', fontWeight: '700', marginTop: 10, marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  textarea: { minHeight: 90, textAlignVertical: 'top' }
});
