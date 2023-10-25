import Resolver from "@forge/resolver";
import { storage, fetch } from "@forge/api";

const resolver = new Resolver();
const defaultAIDataSchema = { SprintPlanSteps: '', SprintTaskPriority: '', SprintLeads: '', DailySummary: '', DailyQuestionsToAsk: '', DailyBottlenecks: '', DailyQueriesToSolve: '', Daily24HoursIssueUpdated: '', Daily3DaysIssueUpdated: '', Daily3DaysIdleIssues: '', Daily7DaysIdleIssues: '', ReviewAchievementsSummary: '', ReviewKeyAchievements: '', ReviewFailureSummary: '', ReviewKeyFailures: '', ReviewTopPerformers: '', ReviewLaggards: '', ReviewBottleneckIssues: '' }

const callOpenAI = async (prompt) => {

  const AppSettings = await storage.get('AppSettings');

  const choiceCount = 1;
  const url = `https://api.openai.com/v1/chat/completions`;

  const payload = {
    model: "gpt-3.5-turbo",
    n: choiceCount,
    messages: [{
      role: 'user',
      content: prompt
    }]
  };

  const options = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AppSettings.APIKey}`,
      'Content-Type': 'application/json',
    },
    redirect: 'follow',
    body: JSON.stringify(payload)
  };

  const response = await fetch(url, options);
  let result = ''

  if (response.status === 200) {
    const chatCompletion = await response.json();
    const firstChoice = chatCompletion.choices[0]

    if (firstChoice) {
      result = firstChoice.message.content;
    } else {
      console.warn(`Chat completion response did not include any assistance choices.`);
      result = `AI response did not include any choices.`;
    }
  } else {
    const text = await response.text();
    result = text;
  }
  return result;
}

const setValueForAIDataset = async (key, value) => {
  const all_fields = await storage.get('AIDataset') || defaultAIDataSchema;
  all_fields[key] = value;
  await storage.set('AIDataset', all_fields);
}

resolver.define("event-listener", async ({ payload, context }) => {

  let response = '';

  if (payload.type === 'callOpenAI-SprintPlanSteps') {
    response = await callOpenAI(payload.data.prompt);
    await setValueForAIDataset('SprintPlanSteps', response);
  }
  if (payload.type === 'callOpenAI-SprintTaskPriority') {
    response = await callOpenAI(payload.data.prompt);
    await setValueForAIDataset('SprintTaskPriority', response);
  }
  if (payload.type === 'callOpenAI-SprintLeads') {
    response = await callOpenAI(payload.data.prompt);
    await setValueForAIDataset('SprintLeads', response);
  }


  if (payload.type === 'callOpenAI-DailySummary') {
    response = await callOpenAI(payload.data.prompt);
    await setValueForAIDataset('DailySummary', response);
  }
  if (payload.type === 'callOpenAI-DailyQuestions') {
    response = await callOpenAI(payload.data.prompt);
    await setValueForAIDataset('DailyQuestionsToAsk', response);
  }
  if (payload.type === 'callOpenAI-DailyBottlenecks') {
    response = await callOpenAI(payload.data.prompt);
    await setValueForAIDataset('DailyBottlenecks', response);
  }
  if (payload.type === 'callOpenAI-DailyQueries') {
    response = await callOpenAI(payload.data.prompt);
    await setValueForAIDataset('DailyQueriesToSolve', response);
  }
  if (payload.type === 'callOpenAI-DailyIssueUpdates24Hours') {
    response = await callOpenAI(payload.data.prompt);
    await setValueForAIDataset('Daily24HoursIssueUpdated', response);
  }
  if (payload.type === 'callOpenAI-DailyIssueUpdates3Days') {
    response = await callOpenAI(payload.data.prompt);
    await setValueForAIDataset('Daily3DaysIssueUpdated', response);
  }
  if (payload.type === 'callOpenAI-DailyIdleIssues3Days') {
    response = await callOpenAI(payload.data.prompt);
    await setValueForAIDataset('Daily3DaysIdleIssues', response);
  }
  if (payload.type === 'callOpenAI-DailyIdleIssues7Days') {
    response = await callOpenAI(payload.data.prompt);
    await setValueForAIDataset('Daily7DaysIdleIssues', response);
  }


  if (payload.type === 'callOpenAI-ReviewAchievementsSummary') {
    response = await callOpenAI(payload.data.prompt);
    await setValueForAIDataset('ReviewAchievementsSummary', response);
  }
  if (payload.type === 'callOpenAI-ReviewAchievements') {
    response = await callOpenAI(payload.data.prompt);
    await setValueForAIDataset('ReviewKeyAchievements', response);
  }
  if (payload.type === 'callOpenAI-ReviewFailuresSummary') {
    response = await callOpenAI(payload.data.prompt);
    await setValueForAIDataset('ReviewFailureSummary', response);
  }
  if (payload.type === 'callOpenAI-ReviewFailures') {
    response = await callOpenAI(payload.data.prompt);
    await setValueForAIDataset('ReviewKeyFailures', response);
  }
  if (payload.type === 'callOpenAI-ReviewTeamPerformanceTop') {
    response = await callOpenAI(payload.data.prompt);
    await setValueForAIDataset('ReviewTopPerformers', response);
  }
  if (payload.type === 'callOpenAI-ReviewTeamPerformanceLags') {
    response = await callOpenAI(payload.data.prompt);
    await setValueForAIDataset('ReviewLaggards', response);
  }
  if (payload.type === 'callOpenAI-ReviewBottleneckIssues') {
    response = await callOpenAI(payload.data.prompt);
    await setValueForAIDataset('ReviewBottleneckIssues', response);
  }

  if (payload.type === 'callOpenAI-AskGPT') {
    response = await callOpenAI(payload.data.prompt);
    await storage.set('AskGPTResponse', response);
  }

});

export const handler = resolver.getDefinitions();