import api, { route, storage, fetch } from "@forge/api";
import ForgeUI, { render, Fragment, Text, Tabs, Tab, Table, Head, ButtonSet, RadioGroup, Radio, SectionMessage, Select, Option, AvatarStack, Form, TextField, Range, CheckboxGroup, Checkbox, Macro, ModalDialog, Strong, Badge, Button, Tag, Avatar, Link, Cell, Row, Heading, ProjectPage, useProductContext, useState, useEffect } from "@forge/ui";
import { Queue } from '@forge/events';

const queue = new Queue({ key: 'queue-name' });
const defaultAIDataSchema = { SprintPlanSteps: '', SprintTaskPriority: '', SprintLeads: '', DailySummary: '', DailyQuestionsToAsk: '', DailyBottlenecks: '', DailyQueriesToSolve: '', Daily24HoursIssueUpdated: '', Daily3DaysIssueUpdated: '', Daily3DaysIdleIssues: '', Daily7DaysIdleIssues: '', ReviewAchievementsSummary: '', ReviewKeyAchievements: '', ReviewFailureSummary: '', ReviewKeyFailures: '', ReviewTopPerformers: '', ReviewLaggards: '', ReviewBottleneckIssues: '' }

const setValueForAIDataset = async (key, value) => {
  const all_fields = await storage.get('AIDataset') || defaultAIDataSchema;
  all_fields[key] = value;
  await storage.set('AIDataset', all_fields);
}

function simplifyIssueData(issue) {
  const { key, fields } = issue;
  const { summary, description } = fields;

  let simplifiedDescription = '';

  if (description && description.content && description.content.length > 0) {
    simplifiedDescription = description.content.reduce((acc, content) => {
      if (content.type === 'paragraph' && content.content && content.content.length > 0) {
        const paragraphText = content.content.map(item => item.text || '').join(' ');
        return acc + paragraphText;
      }
      return acc;
    }, '');
  }

  return {
    key,
    summary,
    description: simplifiedDescription
  };
}

const fetchProjectIssuesData = async (projectIdOrKey) => {
  const response = await api.asUser().requestJira(route`/rest/api/3/search?jql=project%20=%20"${projectIdOrKey}"`, { headers: { 'Accept': 'application/json' } });
  const data = await response.json();
  const simplifiedIssues = data.issues.map(simplifyIssueData);
  return simplifiedIssues;
};

const fetchTeamMembers = async () => {
  const response = await api.asUser().requestJira(route`/rest/api/3/users`, { headers: { 'Accept': 'application/json' } });

  const data = await response.json();
  const teamAccounts = data.filter(item => item.accountType === "atlassian" && item.active === true);
  return teamAccounts;
}

const fetchTeamSkills = async () => {
  return await storage.get('TeamSkills') || [];
};

const fetchAIDataset = async () => {
  return await storage.get('AIDataset') || defaultAIDataSchema;
};

const fetchAppSettings = async () => {
  return await storage.get('AppSettings') || {};
};

const wrapMultiLineText = (text) => {
  const paragraphs = text.split('\n\n');

  return (
    <Fragment>
      {paragraphs.map((paragraph, index) => (
        <Fragment key={index}>
          {paragraph.split('\n').map((line, i) => (
            <Text key={i} content={line} />
          ))}
          <Text></Text>
        </Fragment>
      ))}
    </Fragment>
  );
};


const App = () => {
  const context = useProductContext();

  // default context
  const [teamMembers] = useState(async () => await fetchTeamMembers());
  const [teamSkillState, setTeamSkillState] = useState(async () => await fetchTeamSkills());
  const [appSettingState, setAppSettingState] = useState(async () => await fetchAppSettings());
  const [AIDatasetState, setAIDatasetState] = useState(async () => await fetchAIDataset());
  const [projectIssuesData, setProjectIssuesData] = useState(async () => await fetchProjectIssuesData(context.platformContext.projectId));
  const [askGPTResponseState, setAskGPTResponseState] = useState();

  // form submission
  const onSettingsSubmit = async (formData) => {
    await storage.set('AppSettings', formData);
    setAppSettingState(formData);
  };

  const onSkillSubmit = async (formData) => {
    const updatedSkills = [...teamSkillState, formData];
    await storage.set('TeamSkills', updatedSkills);
    setTeamSkillState(updatedSkills);
  };

  const deleteMemberSkill = async (index) => {
    // TODO: implement delete
  };

  const onAskGPTSubmit = async (formData) => {
    const AIPromptContext = { issues: projectIssuesData, memberSkills: teamSkillState };
    const promptAskGPT = `Here is json containing list of issues and team member skills: ${JSON.stringify(AIPromptContext)}.
    These issues represent backlog tasks/issues of SCRUM based project management.
    Based on above data, answer this question: ${formData.Question}`;
    
    await storage.delete('AskGPTResponse', "");
    let jobId = await queue.push({ type: "callOpenAI-AskGPT", data: { prompt: promptAskGPT } });
  };

  const onAskGPTRefresh = async () => {
    setAskGPTResponseState(await storage.get('AskGPTResponse'));
  };


  // AI Functions

  const startAIPlanningButton = async (prompt_type) => {
    const AIPromptContext = { issues: projectIssuesData, memberSkills: teamSkillState }
    let jobId = null;

    // SPRINT Planning: prompts
    const promptSprintPlanSteps = `Here is json containing list of issues and team member skills: ${JSON.stringify(AIPromptContext)}.
    These issues represent backlog tasks/issues of SCRUM based project management. We need to plan SPRINT out of it.
    Create a step by step plan of action with following instructions:
    - Give a relavant title to each step
    - Club similar or logical issues together
    - Name team members who have relevant skills to work each step's issues.
    - Estimate a time to finish for all issues of this step.
      Based on above instructions, please prepare a plan for the sprint each in a smaller paragraphs or bullet points`;

    const promptSprintTaskPriority = `Here is json containing list of issues and team member skills: ${JSON.stringify(AIPromptContext)}.
    These issues represent backlog tasks/issues of SCRUM based project management. We need to plan SPRINT out of it.
    Arrange issues in priority order and provide a logically arranged list.`;

    const promptSprintLeads = `Here is json containing list of issues and team member skills: ${JSON.stringify(AIPromptContext)}.
    These issues represent backlog tasks/issues of SCRUM based project management. We need to plan SPRINT out of it.
    Which team members can be the lead here based on skill sets?.`;

    // Daily Brief: prompts
    const promptDailySummary = `Here is json containing list of issues and team member skills: ${JSON.stringify(AIPromptContext)}.
    These issues represent backlog tasks/issues of SCRUM based project management. We need to prepare a daily SPRINT meeting out of it.
    Write a brief summary of recent updates, comments and issues.
    `;

    const promptDailyQuestions = `Here is json containing list of issues and team member skills: ${JSON.stringify(AIPromptContext)}.
    These issues represent backlog tasks/issues of SCRUM based project management. We need to prepare a daily SPRINT meeting out of it.
    Prepare a list of questions that I need to ask in today's meeting based on recent issue updates and comments.
    `;

    const promptDailyBottlenecks = `Here is json containing list of issues and team member skills: ${JSON.stringify(AIPromptContext)}.
    These issues represent backlog tasks/issues of SCRUM based project management. We need to prepare a daily SPRINT meeting out of it.
    Prepare a list of bottlenecks or concerns that needs to be resolved based on recent issue updates and comments.
    `;

    const promptDailyQueries = `Here is json containing list of issues and team member skills: ${JSON.stringify(AIPromptContext)}.
    These issues represent backlog tasks/issues of SCRUM based project management. We need to prepare a daily SPRINT meeting out of it.
    Prepare a list of queries that I need to address from my side based on recent issue updates, comments and concerns.
    `;

    const promptDailyIssueUpdates24Hours = `Here is json containing list of issues and team member skills: ${JSON.stringify(AIPromptContext)}.
    These issues represent backlog tasks/issues of SCRUM based project management. We need to prepare a daily SPRINT meeting out of it.
    Prepare a list of issues that were updated in last 24 hours.
    `;

    const promptDailyIssueUpdates3Days = `Here is json containing list of issues and team member skills: ${JSON.stringify(AIPromptContext)}.
    These issues represent backlog tasks/issues of SCRUM based project management. We need to prepare a daily SPRINT meeting out of it.
    Prepare a list of issues that were updated in last 3 days.
    `;

    const promptDailyIdleIssues3Days = `Here is json containing list of issues and team member skills: ${JSON.stringify(AIPromptContext)}.
    These issues represent backlog tasks/issues of SCRUM based project management. We need to prepare a daily SPRINT meeting out of it.
    Prepare a list of issues that are idle and has no updates since last 3 days.
    `;

    const promptDailyIdleIssues7Days = `Here is json containing list of issues and team member skills: ${JSON.stringify(AIPromptContext)}.
    These issues represent backlog tasks/issues of SCRUM based project management. We need to prepare a daily SPRINT meeting out of it.
    Prepare a list of issues that are idle and has no updates since last 7 days.
    `;


    // Review: prompts
    const promptReviewAchievementsSummary = `Here is json containing list of issues and team member skills: ${JSON.stringify(AIPromptContext)}.
    These issues represent backlog tasks/issues of SCRUM based project management. We need to prepare a daily SPRINT meeting out of it.
    Write a brief summary of achievements in this sprint based on recent updates, comments and progess.
    `;

    const promptReviewAchievements = `Here is json containing list of issues and team member skills: ${JSON.stringify(AIPromptContext)}.
    These issues represent backlog tasks/issues of SCRUM based project management. We need to prepare a daily SPRINT meeting out of it.
    Prepare a list of achievements in this sprint based on recent updates, comments and progess.
    `;

    const promptReviewFailuresSummary = `Here is json containing list of issues and team member skills: ${JSON.stringify(AIPromptContext)}.
    These issues represent backlog tasks/issues of SCRUM based project management. We need to prepare a daily SPRINT meeting out of it.
    Write a brief summary of failures in this sprint based on recent updates, comments and progess.
    `;

    const promptReviewFailures = `Here is json containing list of issues and team member skills: ${JSON.stringify(AIPromptContext)}.
    These issues represent backlog tasks/issues of SCRUM based project management. We need to prepare a daily SPRINT meeting out of it.
    Prepare a list of failures in this sprint based on recent updates, comments and progess.
    `;

    const promptReviewTeamPerformanceTop = `Here is json containing list of issues and team member skills: ${JSON.stringify(AIPromptContext)}.
    These issues represent backlog tasks/issues of SCRUM based project management. We need to prepare a daily SPRINT meeting out of it.
    Prepare a list of team members who performed really well in this sprint based on recent updates, comments and progess.
    `;

    const promptReviewTeamPerformanceLags = `Here is json containing list of issues and team member skills: ${JSON.stringify(AIPromptContext)}.
    These issues represent backlog tasks/issues of SCRUM based project management. We need to prepare a daily SPRINT meeting out of it.
    Prepare a list of team members who performed poorly in this sprint based on recent updates, comments and progess.
    `;

    const promptReviewBottleneckIssues = `Here is json containing list of issues and team member skills: ${JSON.stringify(AIPromptContext)}.
    These issues represent backlog tasks/issues of SCRUM based project management. We need to prepare a daily SPRINT meeting out of it.
    Prepare a list of concerns and bottlenecks that needs to be improved in this sprint based on recent updates, comments and progess.
    `;


    // SPRINT Planning: schedule async events
    if (prompt_type === 'Sprint-PlanAll') {
      jobId = await queue.push({ type: "callOpenAI-SprintPlanSteps", data: { prompt: promptSprintPlanSteps } });
      jobId = await queue.push({ type: "callOpenAI-SprintTaskPriority", data: { prompt: promptSprintTaskPriority } });
      jobId = await queue.push({ type: "callOpenAI-SprintLeads", data: { prompt: promptSprintLeads } });
    }
    if (prompt_type === 'Sprint-PlanSteps') {
      jobId = await queue.push({ type: "callOpenAI-SprintPlanSteps", data: { prompt: promptSprintPlanSteps } });
    }
    if (prompt_type === 'Sprint-TaskPriority') {
      jobId = await queue.push({ type: "callOpenAI-SprintTaskPriority", data: { prompt: promptSprintTaskPriority } });
    }
    if (prompt_type === 'Sprint-Leads') {
      jobId = await queue.push({ type: "callOpenAI-SprintLeads", data: { prompt: promptSprintLeads } });
    }

    // Daily Brief: schedule async events
    if (prompt_type === 'Daily-BriefAll') {
      jobId = await queue.push({ type: "callOpenAI-DailySummary", data: { prompt: promptDailySummary } });
      jobId = await queue.push({ type: "callOpenAI-DailyQuestions", data: { prompt: promptDailyQuestions } });
      jobId = await queue.push({ type: "callOpenAI-DailyBottlenecks", data: { prompt: promptDailyBottlenecks } });
      jobId = await queue.push({ type: "callOpenAI-DailyQueries", data: { prompt: promptDailyQueries } });
      jobId = await queue.push({ type: "callOpenAI-DailyIssueUpdates24Hours", data: { prompt: promptDailyIssueUpdates24Hours } });
      jobId = await queue.push({ type: "callOpenAI-DailyIssueUpdates3Days", data: { prompt: promptDailyIssueUpdates3Days } });
      jobId = await queue.push({ type: "callOpenAI-DailyIdleIssues3Days", data: { prompt: promptDailyIdleIssues3Days } });
      jobId = await queue.push({ type: "callOpenAI-DailyIdleIssues7Days", data: { prompt: promptDailyIdleIssues7Days } });
    }
    if (prompt_type === 'Daily-SummaryAndQuestions') {
      jobId = await queue.push({ type: "callOpenAI-DailySummary", data: { prompt: promptDailySummary } });
      jobId = await queue.push({ type: "callOpenAI-DailyQuestions", data: { prompt: promptDailyQuestions } });
    }
    if (prompt_type === 'Daily-BottlenecksAndQueries') {
      jobId = await queue.push({ type: "callOpenAI-DailyBottlenecks", data: { prompt: promptDailyBottlenecks } });
      jobId = await queue.push({ type: "callOpenAI-DailyQueries", data: { prompt: promptDailyQueries } });
    }
    if (prompt_type === 'Daily-IssueUpdates24Hours3Days') {
      jobId = await queue.push({ type: "callOpenAI-DailyIssueUpdates24Hours", data: { prompt: promptDailyIssueUpdates24Hours } });
      jobId = await queue.push({ type: "callOpenAI-DailyIssueUpdates3Days", data: { prompt: promptDailyIssueUpdates3Days } });
    }
    if (prompt_type === 'Daily-IdleIssues3Days7Days') {
      jobId = await queue.push({ type: "callOpenAI-DailyIdleIssues3Days", data: { prompt: promptDailyIdleIssues3Days } });
      jobId = await queue.push({ type: "callOpenAI-DailyIdleIssues7Days", data: { prompt: promptDailyIdleIssues7Days } });
    }


    // Review: schedule async events
    if (prompt_type === 'Review-All') {
      jobId = await queue.push({ type: "callOpenAI-ReviewAchievementsSummary", data: { prompt: promptReviewAchievementsSummary } });
      jobId = await queue.push({ type: "callOpenAI-ReviewAchievements", data: { prompt: promptReviewAchievements } });
      jobId = await queue.push({ type: "callOpenAI-ReviewFailuresSummary", data: { prompt: promptReviewFailuresSummary } });
      jobId = await queue.push({ type: "callOpenAI-ReviewFailures", data: { prompt: promptReviewFailures } });
      jobId = await queue.push({ type: "callOpenAI-ReviewTeamPerformanceTop", data: { prompt: promptReviewTeamPerformanceTop } });
      jobId = await queue.push({ type: "callOpenAI-ReviewTeamPerformanceLags", data: { prompt: promptReviewTeamPerformanceLags } });
      jobId = await queue.push({ type: "callOpenAI-ReviewBottleneckIssues", data: { prompt: promptReviewBottleneckIssues } });
    }
    if (prompt_type === 'Review-SummaryAndAchievements') {
      jobId = await queue.push({ type: "callOpenAI-ReviewAchievementsSummary", data: { prompt: promptReviewAchievementsSummary } });
      jobId = await queue.push({ type: "callOpenAI-ReviewAchievements", data: { prompt: promptReviewAchievements } });
    }
    if (prompt_type === 'Review-SummaryAndFailures') {
      jobId = await queue.push({ type: "callOpenAI-ReviewFailuresSummary", data: { prompt: promptReviewFailuresSummary } });
      jobId = await queue.push({ type: "callOpenAI-ReviewFailures", data: { prompt: promptReviewFailures } });
    }
    if (prompt_type === 'Review-TeamPerformance') {
      jobId = await queue.push({ type: "callOpenAI-ReviewTeamPerformanceTop", data: { prompt: promptReviewTeamPerformanceTop } });
      jobId = await queue.push({ type: "callOpenAI-ReviewTeamPerformanceLags", data: { prompt: promptReviewTeamPerformanceLags } });
    }
    if (prompt_type === 'Review-BottleneckIssues') {
      jobId = await queue.push({ type: "callOpenAI-ReviewBottleneckIssues", data: { prompt: promptReviewBottleneckIssues } });
    }


  };

  const refreshAIDataButton = async () => {
    setAIDatasetState(await fetchAIDataset());
  }

  const actionAskGPTButtons = [
    <Button text="View Response" onClick={async () => { await onAskGPTRefresh(); }} />
  ];

  return (
    <Fragment>
      <Tabs>
        <Tab label="💡 Sprint Planning">
          <Text></Text>
          <Text></Text>
          {(Object.keys(appSettingState).length === 0) &&
            <SectionMessage title="Configration Required" appearance="error">
              <Text>Please configure settings like A.I. API and model choice, etc. "🛠️ App Settings" tab.</Text>
            </SectionMessage>
          }
          {(teamSkillState.length === 0) &&
            <SectionMessage title="Configration Required" appearance="error">
              <Text>Please add team member skills from "🤹 Skill Mapping" tab.</Text>
            </SectionMessage>
          }
          <Table>
            <Row>
              <Cell>
                <SectionMessage title="Let A.I. provide a plan of action for your sprint." appearance="info">
                  <ButtonSet>
                    <Button text="✨ Plan Sprint" appearance="primary" onClick={async () => { await startAIPlanningButton('Sprint-PlanAll'); }} />
                    <Button text="⟳ Refresh Cards" onClick={async () => { await refreshAIDataButton(); }} />
                  </ButtonSet>
                  <Text>&nbsp;</Text>
                  <Text>Note: It can take upto few minutes to get response and update cards below. Sometimes, you may have to refresh page to render new content.</Text>
                  <Text>&nbsp;</Text>
                  <Text>&nbsp;</Text>
                </SectionMessage>
              </Cell>
              <Cell>
                <SectionMessage title="Discover Insights" appearance="info">
                  <Form onSubmit={onAskGPTSubmit} submitButtonText="Ask GPT" actionButtons={actionAskGPTButtons}>
                    <Select name="Question">
                      <Option label="What recent issues or challenges has the team encountered, and how were they addressed?" value="What recent issues or challenges has the team encountered, and how were they addressed?" />
                      <Option label="Are there any user stories that have been delayed or require additional attention?" value="Are there any user stories that have been delayed or require additional attention?" />
                      <Option label="How are tasks currently allocated within the team, and has there been any recent adjustment in responsibilities?" value="How are tasks currently allocated within the team, and has there been any recent adjustment in responsibilities?" />
                      <Option label="How is documentation maintained, and what efforts are made to share knowledge within the team?" value="How is documentation maintained, and what efforts are made to share knowledge within the team?" />
                      <Option label="Are there any impediments or obstacles the team is currently facing?" value="Are there any impediments or obstacles the team is currently facing?" />
                      <Option label="How is communication within the team, and are there any challenges in collaboration?" value="How is communication within the team, and are there any challenges in collaboration?" />
                      <Option label="How is the team handling their current workload, and is there a need for any adjustments?" value="How is the team handling their current workload, and is there a need for any adjustments?" />
                      <Option label="Have there been any recent updates or feedback from customers or stakeholders?" value="Have there been any recent updates or feedback from customers or stakeholders?" />
                    </Select>
                  </Form>
                  <Text>Note: Please wait upto a minute and then click "View Response"</Text>
                  {askGPTResponseState && wrapMultiLineText(askGPTResponseState)}
                </SectionMessage>
              </Cell>
            </Row>
          </Table>

          <Text></Text>
          <Text></Text>
          <SectionMessage title="Sprint Plan" appearance="confirmation">
          {AIDatasetState.SprintPlanSteps ? wrapMultiLineText(AIDatasetState.SprintPlanSteps) : <Text>No Insights Available. Please click 'Generate' button to get insights.</Text>}
            <Text>&nbsp;</Text>
            <ButtonSet>
              <Button text="Convert To Sprint" onClick={async () => { }}></Button>
              <Button text="✨ Generate" onClick={async () => { await startAIPlanningButton('Sprint-PlanSteps'); }} />
              <Button text="⟳ Refresh Card" onClick={async () => { await refreshAIDataButton(); }} />
            </ButtonSet>
          </SectionMessage>
          <SectionMessage title="Task Priority" appearance="error">
          {AIDatasetState.SprintTaskPriority ? wrapMultiLineText(AIDatasetState.SprintTaskPriority) : <Text>No Insights Available. Please click 'Generate' button to get insights.</Text>}
            <Text>&nbsp;</Text>
            <ButtonSet>
              <Button text="✨ Generate" onClick={async () => { await startAIPlanningButton('Sprint-TaskPriority'); }} />
              <Button text="⟳ Refresh Card" onClick={async () => { await refreshAIDataButton(); }} />
            </ButtonSet>
          </SectionMessage>
          <SectionMessage title="Sprint Leads" appearance="warning">
          {AIDatasetState.SprintLeads ? wrapMultiLineText(AIDatasetState.SprintLeads) : <Text>No Insights Available. Please click 'Generate' button to get insights.</Text>}
           <Text>&nbsp;</Text>
            <ButtonSet>
              <Button text="✨ Generate" onClick={async () => { await startAIPlanningButton('Sprint-Leads'); }} />
              <Button text="⟳ Refresh Card" onClick={async () => { await refreshAIDataButton(); }} />
            </ButtonSet>
          </SectionMessage>
        </Tab>
        <Tab label="💬 Daily Standup">
          <Text></Text>
          <Text></Text>
          <Table>
            <Row>
              <Cell>
                <SectionMessage title="Generate Daily Meeting Brief using A.I." appearance="info">
                  <ButtonSet>
                    <Button text="✨ Prepare Daily Brief" appearance="primary" onClick={async () => { await startAIPlanningButton('Daily-BriefAll'); }} />
                    <Button text="⟳ Refresh Cards" onClick={async () => { await refreshAIDataButton(); }} />
                  </ButtonSet>
                  <Text>&nbsp;</Text>
                  <Text>Note: It can take upto few minutes to get response and update cards below. Sometimes, you may have to refresh page to render new content.</Text>
                  <Text>&nbsp;</Text>
                  <Text>&nbsp;</Text>
                </SectionMessage>
              </Cell>
              <Cell>
                <SectionMessage title="Discover Insights" appearance="info">
                  <Form onSubmit={onAskGPTSubmit} submitButtonText="Ask GPT" actionButtons={actionAskGPTButtons} >
                    <Select name="Question">
                      <Option label="What recent issues or challenges has the team encountered, and how were they addressed?" value="What recent issues or challenges has the team encountered, and how were they addressed?" />
                      <Option label="Are there any user stories that have been delayed or require additional attention?" value="Are there any user stories that have been delayed or require additional attention?" />
                      <Option label="How are tasks currently allocated within the team, and has there been any recent adjustment in responsibilities?" value="How are tasks currently allocated within the team, and has there been any recent adjustment in responsibilities?" />
                      <Option label="How is documentation maintained, and what efforts are made to share knowledge within the team?" value="How is documentation maintained, and what efforts are made to share knowledge within the team?" />
                      <Option label="Are there any impediments or obstacles the team is currently facing?" value="Are there any impediments or obstacles the team is currently facing?" />
                      <Option label="How is communication within the team, and are there any challenges in collaboration?" value="How is communication within the team, and are there any challenges in collaboration?" />
                      <Option label="How is the team handling their current workload, and is there a need for any adjustments?" value="How is the team handling their current workload, and is there a need for any adjustments?" />
                      <Option label="Have there been any recent updates or feedback from customers or stakeholders?" value="Have there been any recent updates or feedback from customers or stakeholders?" />
                    </Select>
                  </Form>
                  <Text>Note: Please wait upto a minute and then click "View Response"</Text>
                  {askGPTResponseState && wrapMultiLineText(askGPTResponseState)}
                </SectionMessage>
              </Cell>
            </Row>
          </Table>
          <Text></Text>
          <Text></Text>
          <Table>
            <Row>
              <Cell>
                <SectionMessage title="What to Discuss?" appearance="confirmation">
                  <Heading size="small">Summary</Heading>
                  {AIDatasetState.DailySummary ? wrapMultiLineText(AIDatasetState.DailySummary) : <Text>No Insights Available. Please click 'Generate' button to get insights.</Text>}
                  <Text>&nbsp;</Text>
                  <Heading size="small">Questions to ask?</Heading>
                  {AIDatasetState.DailyQuestionsToAsk ? wrapMultiLineText(AIDatasetState.DailyQuestionsToAsk) : <Text>No Insights Available. Please click 'Generate' button to get insights.</Text>}
                  <Text>&nbsp;</Text>
                  <Text>&nbsp;</Text>
                  <ButtonSet>
                    <Button text="✨ Generate" onClick={async () => { await startAIPlanningButton('Daily-SummaryAndQuestions'); }} />
                    <Button text="⟳ Refresh Card" onClick={async () => { await refreshAIDataButton(); }} />
                  </ButtonSet>
                </SectionMessage>
              </Cell>
              <Cell>
                <SectionMessage title="Issue Comments or Discussions" appearance="error">
                  <Heading size="small">Bottlenecks</Heading>
                  {AIDatasetState.DailyBottlenecks ? wrapMultiLineText(AIDatasetState.DailyBottlenecks) : <Text>No Insights Available. Please click 'Generate' button to get insights.</Text>}
                  <Text>&nbsp;</Text>
                  <Heading size="small">Queries</Heading>
                  {AIDatasetState.DailyQueriesToSolve ? wrapMultiLineText(AIDatasetState.DailyQueriesToSolve) : <Text>No Insights Available. Please click 'Generate' button to get insights.</Text>}
                  <Text>&nbsp;</Text>
                  <Text>&nbsp;</Text>
                  <ButtonSet>
                    <Button text="✨ Generate" onClick={async () => { await startAIPlanningButton('Daily-BottlenecksAndQueries'); }} />
                    <Button text="⟳ Refresh Card" onClick={async () => { await refreshAIDataButton(); }} />
                  </ButtonSet>
                </SectionMessage>
              </Cell>
            </Row>
          </Table>
          <Text></Text>
          <Text></Text>
          <Table>
            <Row>
              <Cell>
                <SectionMessage title="Issue Updates" appearance="info">
                  <Heading size="small">Last 24 Hours</Heading>
                  {AIDatasetState.Daily24HoursIssueUpdated ? wrapMultiLineText(AIDatasetState.Daily24HoursIssueUpdated) : <Text>No Insights Available. Please click 'Generate' button to get insights.</Text>}
                  <Text>&nbsp;</Text>
                  <Heading size="small">Last 3 Days</Heading>
                  {AIDatasetState.Daily3DaysIssueUpdated ? wrapMultiLineText(AIDatasetState.Daily3DaysIssueUpdated) : <Text>No Insights Available. Please click 'Generate' button to get insights.</Text>}
                  <Text>&nbsp;</Text>
                  <Text>&nbsp;</Text>
                  <ButtonSet>
                    <Button text="✨ Generate" onClick={async () => { await startAIPlanningButton('Daily-IssueUpdates24Hours3Days'); }} />
                    <Button text="⟳ Refresh Card" onClick={async () => { await refreshAIDataButton(); }} />
                  </ButtonSet>
                </SectionMessage>
              </Cell>
              <Cell>
                <SectionMessage title="Idle Issues" appearance="warning">
                  <Heading size="small">No Updates since 3 Days</Heading>
                  {AIDatasetState.Daily3DaysIdleIssues ? wrapMultiLineText(AIDatasetState.Daily3DaysIdleIssues) : <Text>No Insights Available. Please click 'Generate' button to get insights.</Text>}
                  <Text>&nbsp;</Text>
                  <Heading size="small">No Updates Since 7 Days</Heading>
                  {AIDatasetState.Daily7DaysIdleIssues ? wrapMultiLineText(AIDatasetState.Daily7DaysIdleIssues) : <Text>No Insights Available. Please click 'Generate' button to get insights.</Text>}
                  <Text>&nbsp;</Text>
                  <Text>&nbsp;</Text>
                  <ButtonSet>
                    <Button text="✨ Generate" onClick={async () => { await startAIPlanningButton('Daily-IdleIssues3Days7Days'); }} />
                    <Button text="⟳ Refresh Card" onClick={async () => { await refreshAIDataButton(); }} />
                  </ButtonSet>
                </SectionMessage>
              </Cell>
            </Row>
          </Table>
        </Tab>
        <Tab label="📝 Sprint Review">
          <Text></Text>
          <Text></Text>
          <Table>
            <Row>
              <Cell>
                <SectionMessage title="Generate Sprint Review using A.I." appearance="info">
                  <ButtonSet>
                    <Button text="✨ Generate Sprint Review" appearance="primary" onClick={async () => { await startAIPlanningButton('Review-All'); }} />
                    <Button text="⟳ Refresh Cards" onClick={async () => { await refreshAIDataButton(); }} />
                  </ButtonSet>
                  <Text>&nbsp;</Text>
                  <Text>Note: It can take upto few minutes to get response and update cards below. Sometimes, you may have to refresh page to render new content.</Text>
                  <Text>&nbsp;</Text>
                  <Text>&nbsp;</Text>
                </SectionMessage>
              </Cell>
              <Cell>
                <SectionMessage title="Discover Insights" appearance="info">
                  <Form onSubmit={onAskGPTSubmit} submitButtonText="Ask GPT" actionButtons={actionAskGPTButtons}>
                    <Select name="Question">
                      <Option label="What recent issues or challenges has the team encountered, and how were they addressed?" value="What recent issues or challenges has the team encountered, and how were they addressed?" />
                      <Option label="Are there any user stories that have been delayed or require additional attention?" value="Are there any user stories that have been delayed or require additional attention?" />
                      <Option label="How are tasks currently allocated within the team, and has there been any recent adjustment in responsibilities?" value="How are tasks currently allocated within the team, and has there been any recent adjustment in responsibilities?" />
                      <Option label="How is documentation maintained, and what efforts are made to share knowledge within the team?" value="How is documentation maintained, and what efforts are made to share knowledge within the team?" />
                      <Option label="Are there any impediments or obstacles the team is currently facing?" value="Are there any impediments or obstacles the team is currently facing?" />
                      <Option label="How is communication within the team, and are there any challenges in collaboration?" value="How is communication within the team, and are there any challenges in collaboration?" />
                      <Option label="How is the team handling their current workload, and is there a need for any adjustments?" value="How is the team handling their current workload, and is there a need for any adjustments?" />
                      <Option label="Have there been any recent updates or feedback from customers or stakeholders?" value="Have there been any recent updates or feedback from customers or stakeholders?" />
                    </Select>
                  </Form>
                  <Text>Note: Please wait upto a minute and then click "View Response"</Text>
                  {askGPTResponseState && wrapMultiLineText(askGPTResponseState)}
                </SectionMessage>
              </Cell>
            </Row>
          </Table>
          <Text></Text>
          <Text></Text>
          <Table>
            <Row>
              <Cell>
                <SectionMessage title="Achievements" appearance="confirmation">
                  <Heading size="small">Summary</Heading>
                  {AIDatasetState.ReviewAchievementsSummary ? wrapMultiLineText(AIDatasetState.ReviewAchievementsSummary) : <Text>No Insights Available. Please click 'Generate' button to get insights.</Text>}
                  <Text>&nbsp;</Text>
                  <Heading size="small">Key Achievements</Heading>
                  {AIDatasetState.ReviewKeyAchievements ? wrapMultiLineText(AIDatasetState.ReviewKeyAchievements) : <Text>No Insights Available. Please click 'Generate' button to get insights.</Text>}
                  <Text>&nbsp;</Text>
                  <Text>&nbsp;</Text>
                  <ButtonSet>
                    <Button text="✨ Generate" onClick={async () => { await startAIPlanningButton('Review-SummaryAndAchievements'); }} />
                    <Button text="⟳ Refresh Card" onClick={async () => { await refreshAIDataButton(); }} />
                  </ButtonSet>
                </SectionMessage>
              </Cell>
              <Cell>
                <SectionMessage title="Failures" appearance="error">
                  <Heading size="small">Summary</Heading>
                  {AIDatasetState.ReviewFailureSummary ? wrapMultiLineText(AIDatasetState.ReviewFailureSummary) : <Text>No Insights Available. Please click 'Generate' button to get insights.</Text>}
                  <Text>&nbsp;</Text>
                  <Heading size="small">Key Failures</Heading>
                  {AIDatasetState.ReviewKeyFailures ? wrapMultiLineText(AIDatasetState.ReviewKeyFailures) : <Text>No Insights Available. Please click 'Generate' button to get insights.</Text>}
                  <Text>&nbsp;</Text>
                  <Text>&nbsp;</Text>
                  <ButtonSet>
                    <Button text="✨ Generate" onClick={async () => { await startAIPlanningButton('Review-SummaryAndFailures'); }} />
                    <Button text="⟳ Refresh Card" onClick={async () => { await refreshAIDataButton(); }} />
                  </ButtonSet>
                </SectionMessage>
              </Cell>
            </Row>
          </Table>
          <Text></Text>
          <Text></Text>
          <Table>
            <Row>
              <Cell>
                <SectionMessage title="Team Peformance" appearance="info">
                  <Heading size="small">Top Performers</Heading>
                  {AIDatasetState.ReviewTopPerformers ? wrapMultiLineText(AIDatasetState.ReviewTopPerformers) : <Text>No Insights Available. Please click 'Generate' button to get insights.</Text>}
                  <Text>&nbsp;</Text>
                  <Heading size="small">Laggards</Heading>
                  {AIDatasetState.ReviewLaggards ? wrapMultiLineText(AIDatasetState.ReviewLaggards) : <Text>No Insights Available. Please click 'Generate' button to get insights.</Text>}
                  <Text>&nbsp;</Text>
                  <Text>&nbsp;</Text>
                  <ButtonSet>
                    <Button text="✨ Generate" onClick={async () => { await startAIPlanningButton('Review-TeamPerformance'); }} />
                    <Button text="⟳ Refresh Card" onClick={async () => { await refreshAIDataButton(); }} />
                  </ButtonSet>
                </SectionMessage>
              </Cell>
              <Cell>
                <SectionMessage title="Bottlenecks" appearance="warning">
                  <Heading size="small">Issues to resolve</Heading>
                  {AIDatasetState.ReviewBottleneckIssues ? wrapMultiLineText(AIDatasetState.ReviewBottleneckIssues) : <Text>No Insights Available. Please click 'Generate' button to get insights.</Text>}
                  <Text>&nbsp;</Text>
                  <Text>&nbsp;</Text>
                  <ButtonSet>
                    <Button text="✨ Generate" onClick={async () => { await startAIPlanningButton('Review-BottleneckIssues'); }} />
                    <Button text="⟳ Refresh Card" onClick={async () => { await refreshAIDataButton(); }} />
                  </ButtonSet>
                </SectionMessage>
              </Cell>
            </Row>
          </Table>
        </Tab>
        <Tab label="🤹 Skill Mapping">
          <Text></Text>
          <Text></Text>
          <Heading size="small">Add New Skill</Heading>
          <Form onSubmit={onSkillSubmit}>
            <Table>
              <Row>
                <Cell>
                  <Select label="Choose Team Member" name="member_name">
                    {teamMembers.map((member) => (
                      <Option label={member.displayName} value={member.displayName} />
                    ))}
                  </Select>
                </Cell>
                <Cell>
                  <TextField name="skill" label="Skill" />
                </Cell>
                <Cell>
                  <Range label="Skill Level" name="skill_level" min={1} max={10} step={1} />
                </Cell>
              </Row>
            </Table>
          </Form>
          <Text></Text>
          <Text></Text>
          <Text></Text>
          <Text></Text>
          <Heading size="small">📊 Team Skills Map</Heading>
          <Table>
            <Head>
              <Cell>
                <Text>Name</Text>
              </Cell>
              <Cell>
                <Text>Skill</Text>
              </Cell>
              <Cell>
                <Text>Level</Text>
              </Cell>
              <Cell>
                <Text>Action</Text>
              </Cell>
            </Head>
            {teamSkillState.map((skill, index) => (
              <Row>
                <Cell>
                  <Text>{skill.member_name}</Text>
                </Cell>
                <Cell>
                  <Text>{skill.skill}</Text>
                </Cell>
                <Cell>
                  <Text>{`${skill.skill_level}/10`}</Text>
                </Cell>
                <Cell>
                  <Button appearance="danger" text="Delete" onClick={async () => { await deleteMemberSkill(index); }}></Button>
                </Cell>
              </Row>
            ))}
          </Table>
        </Tab>
        <Tab label="🛠️ App Settings">
          <Text></Text>
          <Text></Text>
          <Text>Model: {appSettingState.AIModel}</Text>
          <Text>API Key: ************</Text>
          <Text>Anonymize Outgoing Data?: {appSettingState.AIAnonymize}</Text>
          <Form onSubmit={onSettingsSubmit}>
            <TextField name="APIKey" label="API Key" type="password" />
            <Select label="Choose A.I. Model" name="AIModel">
              <Option defaultSelected label="ChatGPT" value="ChatGPT" />
              <Option label="LLama2" value="LLama2" />
              <Option label="Cohere" value="Cohere" />
              <Option label="Anthropic" value="Anthropic" />
            </Select>
            <RadioGroup name="AIAnonymize" label="anonymize outgoing data if using a public model?">
              <Radio value="Yes" label="yes, anonymize" />
              <Radio value="No" label="no, don't anonymize" />
            </RadioGroup>
          </Form>
        </Tab>
      </Tabs>
    </Fragment>
  );
};

export const run = render(
  <ProjectPage>
    <App />
  </ProjectPage>
);