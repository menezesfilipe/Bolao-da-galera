import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight,
  Check,
  ClipboardList,
  Copy,
  Crown,
  DollarSign,
  Gamepad2,
  LogOut,
  Medal,
  MessageSquarePlus,
  ShieldCheck,
  Ticket,
  Trophy,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { supabase, supabaseReady } from './supabaseClient';
import './styles.css';

const STORAGE_KEYS = {
  data: 'bolao-galera-data',
  legacy: 'bolao-copa-data',
  session: 'bolao-galera-session',
};

const seedMatches = [];

const worldCupTeams = [
  'Algeria',
  'Argentina',
  'Australia',
  'Austria',
  'Belgium',
  'Bosnia and Herzegovina',
  'Brazil',
  'Cabo Verde',
  'Canada',
  'Colombia',
  'Congo DR',
  "Cote d'Ivoire",
  'Croatia',
  'Curacao',
  'Czechia',
  'Ecuador',
  'Egypt',
  'England',
  'France',
  'Germany',
  'Ghana',
  'Haiti',
  'Iraq',
  'IR Iran',
  'Japan',
  'Jordan',
  'Korea Republic',
  'Mexico',
  'Morocco',
  'Netherlands',
  'New Zealand',
  'Norway',
  'Panama',
  'Paraguay',
  'Portugal',
  'Qatar',
  'Saudi Arabia',
  'Scotland',
  'Senegal',
  'South Africa',
  'Spain',
  'Sweden',
  'Switzerland',
  'Tunisia',
  'Türkiye',
  'USA',
  'Uruguay',
  'Uzbekistan',
];

const emptyData = () => ({
  boloes: [],
  participants: [],
  matches: seedMatches,
  predictions: [],
});

const emptyForms = {
  bolao: { name: '', entry_fee: '', pix_key: '' },
  invite: { code: '' },
  match: { stage: 'Fase de grupos', home_team: '', away_team: '', starts_at: '' },
  prediction: { match_id: '', home_score: 0, away_score: 0 },
  result: { match_id: '', home_score: 0, away_score: 0 },
};

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function normalizeData(raw) {
  if (!raw || typeof raw !== 'object') return emptyData();

  if (Array.isArray(raw.boloes)) {
    return {
      boloes: raw.boloes ?? [],
      participants: raw.participants ?? [],
      matches: (raw.matches ?? []).map((match) => ({
        ...match,
        bolao_id: match.bolao_id ?? match.group_id ?? null,
        status: match.status ?? 'scheduled',
        home_score: match.home_score ?? null,
        away_score: match.away_score ?? null,
        finished_at: match.finished_at ?? null,
      })),
      predictions: (raw.predictions ?? []).map((prediction) => ({
        ...prediction,
        bolao_id: prediction.bolao_id ?? prediction.group_id ?? null,
      })),
    };
  }

  if (Array.isArray(raw.groups)) {
    const usedCodes = new Set();
    const boloes = raw.groups.map((group) => {
      const invite_code = generateInviteCode(usedCodes);
      usedCodes.add(invite_code);
      return {
        id: group.id,
        name: group.name,
        invite_code,
        organizer_id: `legacy-${group.id}`,
        organizer_name: group.owner_name,
        entry_fee: 0,
        pix_key: '',
        created_at: group.created_at ?? new Date().toISOString(),
      };
    });

    return {
      boloes,
      participants: (raw.participants ?? []).map((participant) => ({
        id: participant.id,
        bolao_id: participant.group_id,
        user_id: `legacy-${participant.id}`,
        name: participant.name,
        email: participant.email ?? '',
        role: 'player',
        payment_status: 'paid',
        created_at: participant.created_at ?? new Date().toISOString(),
      })),
      matches: [],
      predictions: [],
    };
  }

  return emptyData();
}

function loadData() {
  const cached = loadJson(STORAGE_KEYS.data, null);
  if (cached) return normalizeData(cached);

  const legacy = loadJson(STORAGE_KEYS.legacy, null);
  if (legacy) return normalizeData(legacy);

  return emptyData();
}

function loadSession() {
  try {
    localStorage.removeItem(STORAGE_KEYS.session);
  } catch {
    // ignore storage access issues
  }

  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.session);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistData(data) {
  localStorage.setItem(STORAGE_KEYS.data, JSON.stringify(data));
}

function persistSession(session) {
  if (session) {
    sessionStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
  } else {
    sessionStorage.removeItem(STORAGE_KEYS.session);
  }
}

function uid(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
}

function formatMatchDate(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function generateInviteCode(existingCodes = new Set()) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 25; attempt += 1) {
    let suffix = '';
    for (let i = 0; i < 4; i += 1) {
      suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    const code = `GALERA-${suffix}`;
    if (!existingCodes.has(code)) return code;
  }
  return `GALERA-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
}

function outcome(home, away) {
  if (home === away) return 'draw';
  return home > away ? 'home' : 'away';
}

function pointsForPrediction(prediction, match) {
  if (!match || match.status !== 'finished') return 0;
  if (prediction.home_score === match.home_score && prediction.away_score === match.away_score) return 3;
  const predicted = outcome(prediction.home_score, prediction.away_score);
  const actual = outcome(match.home_score, match.away_score);
  return predicted === actual ? 1 : 0;
}

function buildParticipantMap(participants) {
  return participants.reduce((acc, participant) => {
    acc[participant.id] = participant;
    return acc;
  }, {});
}

function buildMatchMap(matches) {
  return matches.reduce((acc, match) => {
    acc[match.id] = match;
    return acc;
  }, {});
}

function App() {
  const [data, setData] = useState(loadData);
  const [session, setSession] = useState(loadSession);
  const [notice, setNotice] = useState('');
  const [authDraft, setAuthDraft] = useState({
    name: session?.name ?? '',
    email: session?.email ?? '',
  });
  const [authStage, setAuthStage] = useState(session?.role ? 'app' : session ? 'role' : 'profile');
  const [forms, setForms] = useState(emptyForms);
  const [selectedBolaoId, setSelectedBolaoId] = useState('');
  const [previewBolao, setPreviewBolao] = useState(null);

  const participantMap = useMemo(() => buildParticipantMap(data.participants), [data.participants]);

  const myBoloes = useMemo(() => {
    if (!session?.id || !session?.role) return [];
    if (session.role === 'organizer') {
      return data.boloes.filter((bolao) => bolao.organizer_id === session.id);
    }

    return data.participants
      .filter((participant) => participant.user_id === session.id)
      .map((participant) => data.boloes.find((bolao) => bolao.id === participant.bolao_id))
      .filter(Boolean);
  }, [data.boloes, data.participants, session]);

  const activeBolao = useMemo(() => {
    if (session?.role === 'organizer') {
      return data.boloes.find((bolao) => bolao.id === selectedBolaoId) ?? myBoloes[0] ?? null;
    }

    if (session?.role === 'player') {
      return myBoloes[0] ?? null;
    }

    return null;
  }, [data.boloes, myBoloes, selectedBolaoId, session?.role]);

  const activeParticipant = useMemo(() => {
    if (!activeBolao || !session?.id) return null;
    return data.participants.find(
      (participant) => participant.bolao_id === activeBolao.id && participant.user_id === session.id,
    );
  }, [activeBolao, data.participants, session?.id]);

  const activeParticipants = useMemo(() => {
    if (!activeBolao) return [];
    return data.participants.filter((participant) => participant.bolao_id === activeBolao.id);
  }, [activeBolao, data.participants]);

  const activeMatches = useMemo(() => {
    if (!activeBolao) return [];
    return data.matches.filter((match) => match.bolao_id === activeBolao.id);
  }, [activeBolao, data.matches]);

  const matchMap = useMemo(() => buildMatchMap(activeMatches), [activeMatches]);

  const activePredictions = useMemo(() => {
    if (!activeBolao) return [];
    return data.predictions.filter((prediction) => prediction.bolao_id === activeBolao.id);
  }, [activeBolao, data.predictions]);

  const activePredictionRows = useMemo(() => {
    return activePredictions.map((prediction) => ({
      ...prediction,
      participant: participantMap[prediction.participant_id],
      match: matchMap[prediction.match_id],
      points: pointsForPrediction(prediction, matchMap[prediction.match_id]),
    }));
  }, [activePredictions, matchMap, participantMap]);

  const ranking = useMemo(() => {
    if (!activeBolao) return [];
    const finishedMatches = activeMatches.filter((match) => match.status === 'finished');
    const scores = activeParticipants.map((participant) => {
      const participantPredictions = activePredictions.filter((prediction) => prediction.participant_id === participant.id);
      const total = participantPredictions.reduce((sum, prediction) => {
        const match = matchMap[prediction.match_id];
        return sum + pointsForPrediction(prediction, match);
      }, 0);
      return {
        ...participant,
        total,
        finishedMatches: finishedMatches.length,
      };
    });

    return scores.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [activeBolao, activeMatches, activeParticipants, activePredictions, matchMap]);

  const pendingCount = useMemo(
    () => activeParticipants.filter((participant) => participant.payment_status === 'pending').length,
    [activeParticipants],
  );

  const paidCount = useMemo(
    () => activeParticipants.filter((participant) => participant.payment_status === 'paid').length,
    [activeParticipants],
  );

  useEffect(() => {
    persistData(data);
  }, [data]);

  useEffect(() => {
    persistSession(session);
  }, [session]);

  const refreshFromSupabase = useCallback(
    async ({ silent = false } = {}) => {
      if (!supabaseReady) return;

      const [boloesRes, participantsRes, matchesRes, predictionsRes] = await Promise.all([
        supabase.from('boloes').select('*').order('created_at', { ascending: false }),
        supabase.from('participants').select('*').order('created_at', { ascending: true }),
        supabase.from('matches').select('*').order('starts_at', { ascending: true }),
        supabase.from('predictions').select('*').order('updated_at', { ascending: false }),
      ]);

      const errors = [boloesRes.error, participantsRes.error, matchesRes.error, predictionsRes.error].filter(Boolean);
      if (errors.length) {
        if (!silent) {
          setNotice('O Supabase ainda nao respondeu como esperado. Estou mantendo o cache local por enquanto.');
        }
        return;
      }

      const remoteData = normalizeData({
        boloes: boloesRes.data ?? [],
        participants: participantsRes.data ?? [],
        matches: matchesRes.data ?? [],
        predictions: predictionsRes.data ?? [],
      });

      setData(remoteData);
      if (!silent) {
        setNotice('Dados sincronizados com o Supabase.');
      }
    },
    [],
  );

  useEffect(() => {
    refreshFromSupabase();
  }, [refreshFromSupabase]);

  useEffect(() => {
    if (!supabaseReady) return undefined;

    const channel = supabase
      .channel('bolao-galera-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boloes' }, () => refreshFromSupabase({ silent: true }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, () =>
        refreshFromSupabase({ silent: true }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () =>
        refreshFromSupabase({ silent: true }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, () =>
        refreshFromSupabase({ silent: true }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshFromSupabase]);

  useEffect(() => {
    if (selectedBolaoId && data.boloes.some((bolao) => bolao.id === selectedBolaoId)) return;
    setSelectedBolaoId(myBoloes[0]?.id ?? data.boloes[0]?.id ?? '');
  }, [data.boloes, myBoloes, selectedBolaoId]);

  async function saveDataMutation(nextData, remoteAction) {
    if (remoteAction && supabaseReady) {
      const result = await remoteAction();
      if (result?.error) {
        setNotice(result.error.message ?? 'Nao consegui concluir a operacao no Supabase.');
        return false;
      }
    }

    setData(nextData);
    return true;
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();
    if (!authDraft.name.trim()) return;

    const nextSession = {
      id: session?.id ?? uid('user'),
      name: authDraft.name.trim(),
      email: authDraft.email.trim(),
      role: '',
    };

    setSession(nextSession);
    setAuthStage('role');
    setNotice('Agora escolha se voce vai organizar ou jogar.');
  }

  async function chooseRole(role) {
    const nextSession = {
      ...(session ?? {
        id: uid('user'),
        name: authDraft.name.trim(),
        email: authDraft.email.trim(),
      }),
      role,
    };

    setSession(nextSession);
    setAuthStage('app');
    setSelectedBolaoId('');
    setNotice(role === 'organizer' ? 'Modo organizador ativado.' : 'Modo jogador ativado.');
  }

  function logout() {
    setSession(null);
    setAuthStage('profile');
    setAuthDraft({ name: '', email: '' });
    setSelectedBolaoId('');
    setPreviewBolao(null);
    setNotice('Sessao encerrada.');
  }

  async function createBolao(event) {
    event.preventDefault();
    if (!session?.id || session.role !== 'organizer') return;
    if (!forms.bolao.name.trim() || !forms.bolao.entry_fee || !forms.bolao.pix_key.trim()) return;

    const existingCodes = new Set(data.boloes.map((bolao) => bolao.invite_code));
    const bolao = {
      id: uid('bolao'),
      name: forms.bolao.name.trim(),
      invite_code: generateInviteCode(existingCodes),
      organizer_id: session.id,
      organizer_name: session.name,
      entry_fee: Number(forms.bolao.entry_fee),
      pix_key: forms.bolao.pix_key.trim(),
      created_at: new Date().toISOString(),
    };

    const organizerParticipant = {
      id: uid('participant'),
      bolao_id: bolao.id,
      user_id: session.id,
      name: session.name,
      email: session.email,
      role: 'organizer',
      payment_status: 'paid',
      created_at: new Date().toISOString(),
    };

    const nextData = {
      ...data,
      boloes: [bolao, ...data.boloes],
      participants: [organizerParticipant, ...data.participants],
    };

    const ok = await saveDataMutation(nextData, async () => {
      const createdBolao = await supabase.from('boloes').insert(bolao).select().single();
      if (createdBolao.error) return createdBolao;
      const createdParticipant = await supabase.from('participants').insert(organizerParticipant).select().single();
      if (createdParticipant.error) return createdParticipant;
      return { error: null };
    });

    if (!ok) return;

    setForms((current) => ({ ...current, bolao: emptyForms.bolao }));
    setSelectedBolaoId(bolao.id);
    setNotice(`Bolao criado. Codigo de convite: ${bolao.invite_code}`);
  }

  async function deleteBolao() {
    if (!activeBolao || session?.role !== 'organizer') return;

    const confirmed = window.confirm(
      `Apagar o bolão "${activeBolao.name}"? Isso vai remover participantes, jogos e palpites ligados a ele.`,
    );
    if (!confirmed) return;

    const nextData = {
      ...data,
      boloes: data.boloes.filter((bolao) => bolao.id !== activeBolao.id),
      participants: data.participants.filter((participant) => participant.bolao_id !== activeBolao.id),
      matches: data.matches.filter((match) => match.bolao_id !== activeBolao.id),
      predictions: data.predictions.filter((prediction) => prediction.bolao_id !== activeBolao.id),
    };

    const ok = await saveDataMutation(nextData, async () => {
      return supabase.from('boloes').delete().eq('id', activeBolao.id);
    });

    if (!ok) return;

    setSelectedBolaoId('');
    setPreviewBolao(null);
    setForms((current) => ({
      ...current,
      prediction: emptyForms.prediction,
      result: emptyForms.result,
      match: emptyForms.match,
    }));
    setNotice('Bolão apagado.');
  }

  function lookupBolaoByCode(event) {
    event.preventDefault();
    const code = forms.invite.code.trim().toUpperCase();
    if (!code) return;

    const bolao = data.boloes.find((item) => item.invite_code.toUpperCase() === code);
    setPreviewBolao(bolao ?? null);
    if (!bolao) {
      setNotice('Codigo nao encontrado.');
      return;
    }

    setSelectedBolaoId(bolao.id);
    setNotice('Achei o bolao. Agora voce pode entrar e ver a inscricao.');
  }

  async function joinBolao() {
    if (!session?.id || session.role !== 'player' || !previewBolao) return;

    const existingParticipant = data.participants.find(
      (participant) => participant.bolao_id === previewBolao.id && participant.user_id === session.id,
    );

    if (existingParticipant) {
      setSelectedBolaoId(previewBolao.id);
      setNotice('Voce ja esta neste bolao.');
      return;
    }

    const participant = {
      id: uid('participant'),
      bolao_id: previewBolao.id,
      user_id: session.id,
      name: session.name,
      email: session.email,
      role: 'player',
      payment_status: 'pending',
      created_at: new Date().toISOString(),
    };

    const nextData = {
      ...data,
      participants: [participant, ...data.participants],
    };

    const ok = await saveDataMutation(nextData, async () => {
      return supabase.from('participants').insert(participant).select().single();
    });

    if (!ok) return;

    setSelectedBolaoId(previewBolao.id);
    setNotice('Entrada solicitada. Aguardando confirmacao do pagamento pelo organizador.');
  }

  async function createMatch(event) {
    event.preventDefault();
    if (!activeBolao || session?.role !== 'organizer') return;
    if (!forms.match.home_team || !forms.match.away_team || !forms.match.starts_at) return;
    if (forms.match.home_team === forms.match.away_team) return;

    const match = {
      id: uid('match'),
      bolao_id: activeBolao.id,
      stage: forms.match.stage.trim() || 'Fase de grupos',
      home_team: forms.match.home_team,
      away_team: forms.match.away_team,
      starts_at: new Date(forms.match.starts_at).toISOString(),
      status: 'scheduled',
      home_score: null,
      away_score: null,
      finished_at: null,
      created_at: new Date().toISOString(),
    };

    const nextData = {
      ...data,
      matches: [match, ...data.matches],
    };

    const ok = await saveDataMutation(nextData, async () => {
      return supabase.from('matches').insert(match).select().single();
    });

    if (!ok) return;

    setForms((current) => ({
      ...current,
      match: emptyForms.match,
    }));
    setNotice('Jogo adicionado ao bolão.');
  }

  async function confirmPayment(participantId) {
    const updatedParticipants = data.participants.map((participant) =>
      participant.id === participantId ? { ...participant, payment_status: 'paid' } : participant,
    );

    const nextData = {
      ...data,
      participants: updatedParticipants,
    };

    const ok = await saveDataMutation(nextData, async () => {
      return supabase.from('participants').update({ payment_status: 'paid' }).eq('id', participantId).select().single();
    });

    if (!ok) return;
    setNotice('Pagamento confirmado.');
  }

  async function saveMatchResult(matchId, homeScore, awayScore) {
    if (!activeBolao) return;

    const nextMatches = data.matches.map((match) => {
      if (match.id !== matchId) return match;
      return {
        ...match,
        status: 'finished',
        home_score: Number(homeScore),
        away_score: Number(awayScore),
        finished_at: new Date().toISOString(),
      };
    });

    const nextData = {
      ...data,
      matches: nextMatches,
    };

    const payload = nextMatches.find((match) => match.id === matchId);
    const ok = await saveDataMutation(nextData, async () => {
      return supabase
        .from('matches')
        .update({
          status: 'finished',
          home_score: payload.home_score,
          away_score: payload.away_score,
          finished_at: payload.finished_at,
        })
        .eq('id', matchId)
        .select()
        .single();
    });

    if (!ok) return;
    setNotice('Resultado salvo. O ranking foi atualizado.');
  }

  async function savePrediction(event) {
    event.preventDefault();
    if (!activeBolao || !activeParticipant || activeParticipant.payment_status !== 'paid') return;
    if (!forms.prediction.match_id) return;

    const match = activeMatches.find((item) => item.id === forms.prediction.match_id);
    if (!match || match.status === 'finished') return;

    const prediction = {
      id: uid('prediction'),
      bolao_id: activeBolao.id,
      participant_id: activeParticipant.id,
      match_id: match.id,
      home_score: Number(forms.prediction.home_score),
      away_score: Number(forms.prediction.away_score),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const existingIndex = data.predictions.findIndex(
      (item) => item.bolao_id === activeBolao.id && item.participant_id === activeParticipant.id && item.match_id === match.id,
    );

    const nextPredictions = [...data.predictions];
    if (existingIndex >= 0) {
      nextPredictions[existingIndex] = { ...nextPredictions[existingIndex], ...prediction, id: nextPredictions[existingIndex].id };
    } else {
      nextPredictions.unshift(prediction);
    }

    const nextData = {
      ...data,
      predictions: nextPredictions,
    };

    const ok = await saveDataMutation(nextData, async () => {
      return supabase
        .from('predictions')
        .upsert(prediction, { onConflict: 'participant_id,match_id' })
        .select()
        .single();
    });

    if (!ok) return;

    setNotice('Pitaco salvo.');
  }

  function updateForm(section, field, value) {
    setForms((current) => ({
      ...current,
      [section]: { ...current[section], [field]: value },
    }));
  }

  async function copyInviteCode() {
    if (!activeBolao) return;
    try {
      await navigator.clipboard.writeText(activeBolao.invite_code);
      setNotice('Codigo copiado.');
    } catch {
      setNotice(`Codigo: ${activeBolao.invite_code}`);
    }
  }

  if (session?.role === 'player' && !activeBolao) {
    return (
      <main className="auth-shell">
        <div className="auth-panel">
          <p className="eyebrow">Bolão da Galera</p>
          <h1>Entre com o código do bolão</h1>
          <p className="lede">
            Voce ainda nao esta em nenhum bolão. Digite o código que o organizador enviou para liberar a interface completa.
          </p>
          <form className="stack" onSubmit={lookupBolaoByCode}>
            <Input
              label="Codigo de convite"
              value={forms.invite.code}
              onChange={(event) => updateForm('invite', 'code', event.target.value.toUpperCase())}
              placeholder="GALERA-7X9K"
            />
            <Button type="submit" icon={<ArrowRight size={16} />}>Buscar bolão</Button>
          </form>

          {previewBolao ? (
            <div className="preview-card" style={{ marginTop: '16px' }}>
              <div className="preview-head">
                <strong>{previewBolao.name}</strong>
                <span>{previewBolao.invite_code}</span>
              </div>
              <div className="preview-info">
                <div>
                  <small>Inscrição</small>
                  <strong>{formatCurrency(previewBolao.entry_fee)}</strong>
                </div>
                <div>
                  <small>PIX</small>
                  <strong>{previewBolao.pix_key || 'Nao informado'}</strong>
                </div>
              </div>
              <button type="button" className="secondary-button" onClick={joinBolao}>
                Entrar no bolão
              </button>
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  if (authStage === 'profile') {
    return (
      <main className="auth-shell">
        <div className="auth-panel">
          <p className="eyebrow">Bolao da Galera</p>
          <h1>Entre na roda do bolao</h1>
          <p className="lede">Comece com nome e email para abrir seu acesso ao app.</p>
          <form className="stack" onSubmit={handleProfileSubmit}>
            <Input label="Nome" value={authDraft.name} onChange={(event) => setAuthDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Seu nome" />
            <Input label="Email" type="email" value={authDraft.email} onChange={(event) => setAuthDraft((current) => ({ ...current, email: event.target.value }))} placeholder="voce@email.com" />
            <Button type="submit" icon={<ArrowRight size={16} />}>Continuar</Button>
          </form>
        </div>
      </main>
    );
  }

  if (authStage === 'role') {
    return (
      <main className="auth-shell">
        <div className="auth-panel">
          <p className="eyebrow">Passo 2</p>
          <h1>Escolha seu papel</h1>
          <p className="lede">Organizadores criam e administram o bolao. Jogadores entram usando o codigo.</p>
          <div className="role-grid">
            <button type="button" className="role-card" onClick={() => chooseRole('organizer')}>
              <Crown size={22} />
              <strong>Organizador</strong>
              <span>Cria o bolao, recebe pagamentos e fecha os resultados.</span>
            </button>
            <button type="button" className="role-card" onClick={() => chooseRole('player')}>
              <Gamepad2 size={22} />
              <strong>Jogador</strong>
              <span>Entra com o codigo, acompanha o pagamento e envia seus palpites.</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="app-hero">
        <div className="app-topbar">
          <div className="brand">
            <div className="brand-mark">
              <Trophy size={24} />
            </div>
            <div>
              <p className="eyebrow">Bolao da Galera</p>
              <h1>Seu bolao com convite, pagamento e ranking real</h1>
            </div>
          </div>
          <div className="hero-actions">
            <StatusPill icon={<ShieldCheck size={14} />} text={session.role === 'organizer' ? 'Modo organizador' : 'Modo jogador'} />
            <StatusPill icon={<Users size={14} />} text={`${data.boloes.length} bolões`} />
            <button className="ghost-button" onClick={logout}>
              <LogOut size={14} />
              Sair
            </button>
          </div>
        </div>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="hero-kicker">Bem-vindo, {session.name}</p>
            <h2>Organize, convide, confirme pagamentos e acompanhe o placar de verdade.</h2>
            <p className="hero-text">
              O ranking só conta depois que o organizador finalizar a partida. Enquanto isso, os jogadores veem o valor da inscrição e a chave PIX do bolão.
            </p>
          </div>
          <div className="hero-stats">
            <MetricCard icon={<Ticket size={16} />} label="Bolões" value={data.boloes.length} />
            <MetricCard icon={<Wallet size={16} />} label="Pagos" value={paidCount} />
            <MetricCard icon={<ClipboardList size={16} />} label="Pendentes" value={pendingCount} />
          </div>
        </div>
      </header>

      {notice ? <div className="notice-bar">{notice}</div> : null}

      <section className="content-grid">
        <aside className="sidebar">
          <Card title="Meus bolões" icon={<Users size={18} />}>
            <div className="list">
              {myBoloes.length === 0 ? <EmptyState text="Ainda nao ha bolões vinculados ao seu perfil." /> : null}
              {myBoloes.map((bolao) => (
                <button
                  type="button"
                  key={bolao.id}
                  className={`bolao-item ${selectedBolaoId === bolao.id ? 'active' : ''}`}
                  onClick={() => setSelectedBolaoId(bolao.id)}
                >
                  <strong>{bolao.name}</strong>
                  <span>{bolao.invite_code}</span>
                </button>
              ))}
            </div>
          </Card>

          {session.role === 'organizer' ? (
            <Card title="Criar bolão" icon={<MessageSquarePlus size={18} />}>
              <form className="stack" onSubmit={createBolao}>
                <Input
                  label="Nome do bolão"
                  value={forms.bolao.name}
                  onChange={(event) => updateForm('bolao', 'name', event.target.value)}
                  placeholder="Galera da Firma"
                />
                <Input
                  label="Valor da inscrição"
                  type="number"
                  min="0"
                  step="0.01"
                  value={forms.bolao.entry_fee}
                  onChange={(event) => updateForm('bolao', 'entry_fee', event.target.value)}
                  placeholder="25.00"
                />
                <Input
                  label="Chave PIX"
                  value={forms.bolao.pix_key}
                  onChange={(event) => updateForm('bolao', 'pix_key', event.target.value)}
                  placeholder="email, chave aleatoria ou CPF"
                />
                <Button type="submit" icon={<Check size={16} />}>Criar bolão</Button>
              </form>
            </Card>
          ) : (
            <Card title="Entrar no bolão" icon={<UserPlus size={18} />}>
              <form className="stack" onSubmit={lookupBolaoByCode}>
                <Input
                  label="Codigo de convite"
                  value={forms.invite.code}
                  onChange={(event) => updateForm('invite', 'code', event.target.value.toUpperCase())}
                  placeholder="GALERA-7X9K"
                />
                <Button type="submit" icon={<ArrowRight size={16} />}>Buscar bolão</Button>
              </form>

              {previewBolao ? (
                <div className="preview-card">
                  <div className="preview-head">
                    <strong>{previewBolao.name}</strong>
                    <span>{previewBolao.invite_code}</span>
                  </div>
                  <div className="preview-info">
                    <div>
                      <small>Inscrição</small>
                      <strong>{formatCurrency(previewBolao.entry_fee)}</strong>
                    </div>
                    <div>
                      <small>PIX</small>
                      <strong>{previewBolao.pix_key || 'Nao informado'}</strong>
                    </div>
                  </div>
                  <button type="button" className="secondary-button" onClick={joinBolao}>
                    Entrar no bolão
                  </button>
                </div>
              ) : null}
            </Card>
          )}

          {session.role === 'organizer' && activeBolao ? (
            <Card title="Adicionar jogo" icon={<Gamepad2 size={18} />}>
              <form className="stack" onSubmit={createMatch}>
                <Input
                  label="Fase"
                  value={forms.match.stage}
                  onChange={(event) => updateForm('match', 'stage', event.target.value)}
                  placeholder="Fase de grupos"
                />
                <Select
                  label="Mandante"
                  value={forms.match.home_team}
                  onChange={(event) => updateForm('match', 'home_team', event.target.value)}
                >
                  <option value="">Selecione</option>
                  {worldCupTeams.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Visitante"
                  value={forms.match.away_team}
                  onChange={(event) => updateForm('match', 'away_team', event.target.value)}
                >
                  <option value="">Selecione</option>
                  {worldCupTeams.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Data e hora"
                  type="datetime-local"
                  value={forms.match.starts_at}
                  onChange={(event) => updateForm('match', 'starts_at', event.target.value)}
                />
                <Button type="submit" icon={<Check size={16} />}>Adicionar jogo</Button>
              </form>
            </Card>
          ) : null}

          {activeBolao ? (
            <Card title="Convite e dados" icon={<Copy size={18} />}>
              <div className="invite-panel">
                <div>
                  <small>Codigo do bolão</small>
                  <strong>{activeBolao.invite_code}</strong>
                </div>
                <button type="button" className="secondary-button" onClick={copyInviteCode}>
                  Copiar codigo
                </button>
              </div>
              <div className="detail-grid">
                <DetailItem label="Inscrição" value={formatCurrency(activeBolao.entry_fee)} />
                <DetailItem label="PIX" value={activeBolao.pix_key} />
                <DetailItem label="Organizador" value={activeBolao.organizer_name} />
                <DetailItem label="Participantes" value={activeParticipants.length} />
              </div>
            </Card>
          ) : null}

          {session.role === 'organizer' ? (
            <Card title="Seleções da Copa" icon={<Ticket size={18} />}>
              <div className="team-grid">
                {worldCupTeams.map((team) => (
                  <span className="team-chip" key={team}>
                    {team}
                  </span>
                ))}
              </div>
            </Card>
          ) : null}
        </aside>

        <section className="main-column">
          {!activeBolao ? (
            <Card title="Sem bolão ativo" icon={<Wallet size={18} />}>
              <EmptyState text="Crie um bolão ou entre por codigo para liberar os painéis principais." />
            </Card>
          ) : (
            <>
              <Card title="Bolão ativo" icon={<Ticket size={18} />}>
                <div className="bolao-overview">
                  <div className="overview-main">
                    <p className="eyebrow">Nome do bolão</p>
                    <h2>{activeBolao.name}</h2>
                    <div className="overview-inline">
                      <span>
                        Código: <strong>{activeBolao.invite_code}</strong>
                      </span>
                      <button type="button" className="secondary-button" onClick={copyInviteCode}>
                        Copiar código
                      </button>
                      {session.role === 'organizer' ? (
                        <button type="button" className="danger-button" onClick={deleteBolao}>
                          Apagar bolão
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="overview-grid">
                    <DetailItem label="Participantes" value={activeParticipants.length} />
                    <DetailItem label="Pagos" value={paidCount} />
                    <DetailItem label="Pendentes" value={pendingCount} />
                    <DetailItem label="Inscrição" value={formatCurrency(activeBolao.entry_fee)} />
                    <DetailItem label="PIX" value={activeBolao.pix_key} />
                    <DetailItem label="Organizador" value={activeBolao.organizer_name} />
                  </div>
                </div>
              </Card>

              <Card title="Ranking" icon={<Crown size={18} />}>
                {activeMatches.some((match) => match.status === 'finished') ? (
                  <div className="ranking-list">
                    {ranking.map((item, index) => (
                      <div className="ranking-item" key={item.id}>
                        <span className="rank-badge">{index + 1}</span>
                        <div>
                          <strong>{item.name}</strong>
                          <small>{item.payment_status === 'paid' ? 'Pago' : 'Pendente'}</small>
                        </div>
                        <span>{item.total} pts</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState text="O ranking só aparece depois que o organizador finalizar pelo menos um jogo." />
                )}
              </Card>

              <div className="metrics-row">
                <MetricCard icon={<Users size={16} />} label="Participantes" value={activeParticipants.length} />
                <MetricCard icon={<Wallet size={16} />} label="Pagos" value={paidCount} />
                <MetricCard icon={<Trophy size={16} />} label="Jogos finalizados" value={activeMatches.filter((match) => match.status === 'finished').length} />
                <MetricCard icon={<Medal size={16} />} label="Meus pontos" value={ranking.find((item) => item.user_id === session.id)?.total ?? 0} />
              </div>

              {session.role === 'organizer' ? (
                <Card title="Pagamentos" icon={<DollarSign size={18} />}>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Participante</th>
                          <th>Status</th>
                          <th>Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeParticipants.map((participant) => (
                          <tr key={participant.id}>
                            <td>
                              <strong>{participant.name}</strong>
                              <span>{participant.email || 'Sem email'}</span>
                            </td>
                            <td>
                              <StatusBadge status={participant.payment_status} />
                            </td>
                            <td>
                              {participant.payment_status === 'pending' ? (
                                <button type="button" className="secondary-button" onClick={() => confirmPayment(participant.id)}>
                                  Confirmar pagamento
                                </button>
                              ) : (
                                <span className="muted-text">Pago</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {activeParticipants.length === 0 ? (
                          <tr>
                            <td colSpan="3">
                              <EmptyState text="Quando pessoas entrarem no bolão, elas vão aparecer aqui com o status de pagamento." />
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : (
                <Card title="Seu status" icon={<ShieldCheck size={18} />}>
                  {activeParticipant ? (
                    <div className="status-hero">
                      <StatusBadge status={activeParticipant.payment_status} />
                      <p>
                        {activeParticipant.payment_status === 'pending'
                          ? 'Seu cadastro esta aguardando pagamento. O organizador precisa confirmar antes de liberar os palpites.'
                          : 'Pagamento confirmado. Agora voce pode palpitar nos jogos em aberto.'}
                      </p>
                    </div>
                  ) : (
                    <EmptyState text="Voce ainda nao entrou neste bolão." />
                  )}
                </Card>
              )}

              <div className="split-grid">
                {session.role === 'organizer' ? (
                  <Card title="Jogos e resultados" icon={<Gamepad2 size={18} />}>
                    <div className="match-list">
                      {activeMatches.length === 0 ? (
                        <EmptyState text="Ainda nao existem jogos cadastrados para este bolão." />
                      ) : (
                        activeMatches.map((match) => (
                          <div className="match-card" key={match.id}>
                            <div className="match-head">
                              <span>{match.stage}</span>
                              <small>{formatMatchDate(match.starts_at)}</small>
                            </div>
                            <div className="match-line">
                              <strong>{match.home_team}</strong>
                              <span>vs</span>
                              <strong className="right">{match.away_team}</strong>
                            </div>
                            <div className="result-grid">
                              <Input
                                label="Mandante"
                                type="number"
                                min="0"
                                value={forms.result.match_id === match.id ? forms.result.home_score : match.home_score ?? ''}
                                onChange={(event) =>
                                  setForms((current) => ({
                                    ...current,
                                    result: {
                                      match_id: match.id,
                                      home_score: event.target.value,
                                      away_score:
                                        current.result.match_id === match.id ? current.result.away_score : match.away_score ?? 0,
                                    },
                                  }))
                                }
                              />
                              <Input
                                label="Visitante"
                                type="number"
                                min="0"
                                value={forms.result.match_id === match.id ? forms.result.away_score : match.away_score ?? ''}
                                onChange={(event) =>
                                  setForms((current) => ({
                                    ...current,
                                    result: {
                                      match_id: match.id,
                                      home_score:
                                        current.result.match_id === match.id ? current.result.home_score : match.home_score ?? 0,
                                      away_score: event.target.value,
                                    },
                                  }))
                                }
                              />
                            </div>
                            <button
                              type="button"
                              className="primary-button"
                              onClick={() =>
                                saveMatchResult(
                                  match.id,
                                  forms.result.match_id === match.id ? forms.result.home_score : match.home_score ?? 0,
                                  forms.result.match_id === match.id ? forms.result.away_score : match.away_score ?? 0,
                                )
                              }
                            >
                              {match.status === 'finished' ? 'Atualizar resultado' : 'Finalizar jogo'}
                            </button>
                            {match.status === 'finished' ? (
                              <p className="match-status">
                                Resultado final: {match.home_score} x {match.away_score}
                              </p>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </Card>
                ) : (
                  <Card title="Jogos cadastrados" icon={<Gamepad2 size={18} />}>
                    <div className="match-list">
                      {activeMatches.length === 0 ? (
                        <EmptyState text="Ainda nao existem jogos cadastrados para este bolão." />
                      ) : (
                        activeMatches.map((match) => (
                          <div className="match-card" key={match.id}>
                            <div className="match-head">
                              <span>{match.stage}</span>
                              <small>{formatMatchDate(match.starts_at)}</small>
                            </div>
                            <div className="match-line">
                              <strong>{match.home_team}</strong>
                              <span>vs</span>
                              <strong className="right">{match.away_team}</strong>
                            </div>
                            <p className="match-status">
                              {match.status === 'finished'
                                ? `Resultado final: ${match.home_score} x ${match.away_score}`
                                : 'Jogo cadastrado aguardando resultado do organizador.'}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>
                )}

                <Card title="Seu pitaco" icon={<ClipboardList size={18} />}>
                  {activeParticipant ? (
                    activeParticipant.payment_status === 'paid' ? (
                      <form className="stack" onSubmit={savePrediction}>
                        <Select
                          label="Jogo"
                          value={forms.prediction.match_id}
                          onChange={(event) => updateForm('prediction', 'match_id', event.target.value)}
                        >
                          <option value="">Selecione</option>
                          {activeMatches
                            .filter((match) => match.status !== 'finished')
                            .map((match) => (
                              <option key={match.id} value={match.id}>
                                {match.home_team} x {match.away_team}
                              </option>
                            ))}
                        </Select>
                        <div className="score-row">
                          <Input
                            label="Mandante"
                            type="number"
                            min="0"
                            value={forms.prediction.home_score}
                            onChange={(event) => updateForm('prediction', 'home_score', event.target.value)}
                          />
                          <Input
                            label="Visitante"
                            type="number"
                            min="0"
                            value={forms.prediction.away_score}
                            onChange={(event) => updateForm('prediction', 'away_score', event.target.value)}
                          />
                        </div>
                        <Button type="submit" icon={<Check size={16} />}>Salvar pitaco</Button>
                      </form>
                    ) : (
                      <EmptyState text="Depois que o pagamento for confirmado, seu formulario de palpites vai aparecer aqui." />
                    )
                  ) : (
                    <EmptyState text="Entre no bolão para começar a apostar." />
                  )}
                </Card>
              </div>

              <Card title="Histórico de palpites" icon={<ClipboardList size={18} />}>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Jogador</th>
                        <th>Jogo</th>
                        <th>Palpite</th>
                        <th>Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePredictionRows.length === 0 ? (
                        <tr>
                          <td colSpan="4">
                            <EmptyState text="Ainda nao existem palpites neste bolão." />
                          </td>
                        </tr>
                      ) : (
                        activePredictionRows.map((row) => (
                          <tr key={row.id}>
                            <td>{row.participant?.name ?? 'Participante'}</td>
                            <td>
                              {row.match?.home_team} x {row.match?.away_team}
                            </td>
                            <td>{row.home_score} x {row.away_score}</td>
                            <td>
                              <StatusBadge status={String(row.points)} tone="score" />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </section>
      </section>
    </main>
  );
}

function Input({ label, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}

function Select({ label, children, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select {...props}>{children}</select>
    </label>
  );
}

function Button({ icon, children, ...props }) {
  return (
    <button className="primary-button" {...props}>
      {icon}
      {children}
    </button>
  );
}

function Card({ title, icon, children }) {
  return (
    <section className="card">
      <div className="card-head">
        <div className="card-title">
          {icon}
          <h3>{title}</h3>
        </div>
      </div>
      {children}
    </section>
  );
}

function StatusPill({ icon, text }) {
  return (
    <div className="status-pill">
      {icon}
      <span>{text}</span>
    </div>
  );
}

function MetricCard({ icon, label, value }) {
  return (
    <div className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="detail-item">
      <small>{label}</small>
      <strong>{value || '-'}</strong>
    </div>
  );
}

function EmptyState({ text }) {
  return <p className="empty-state">{text}</p>;
}

function StatusBadge({ status, tone }) {
  if (tone === 'score') {
    return <span className="badge badge-score">{status}</span>;
  }

  return <span className={`badge badge-${status}`}>{status === 'pending' ? 'Pagamento pendente' : 'Pago'}</span>;
}

createRoot(document.getElementById('root')).render(<App />);
