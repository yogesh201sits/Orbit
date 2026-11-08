import type {
  IWorkflowRunRepository,
  IWorkflowStepRepository,
  IWorkflowEventRepository,
  WorkflowRunRecord,
  WorkflowStepRecord,
} from "@durable/storage";
import { isTerminalRunStatus } from "../execution/state-machine";
import { EngineError } from "../errors/engine-errors";

export interface RecoveredRunState {
  readonly run: WorkflowRunRecord;
  readonly completedStepOutputs: Map<string, unknown>;
  readonly completedStepIds: Set<string>;
  readonly interruptedStep?: WorkflowStepRecord | undefined;
  readonly isAlreadyTerminal: boolean;
}

export class RecoveryManager {
  constructor(
    private readonly runRepo: IWorkflowRunRepository,
    private readonly stepRepo: IWorkflowStepRepository,
    private readonly eventRepo?: IWorkflowEventRepository | undefined
  ) {}

  async inspectRun(tenantId: string, runId: string): Promise<RecoveredRunState> {
    const run = await this.runRepo.findById(tenantId, runId);
    if (!run) {
      throw new EngineError(`Workflow run "${runId}" not found for tenant "${tenantId}"`);
    }

    if (isTerminalRunStatus(run.status)) {
      return {
        run,
        completedStepOutputs: new Map(),
        completedStepIds: new Set(),
        isAlreadyTerminal: true,
      };
    }

    const steps = await this.stepRepo.listByRun(runId);
    const completedStepOutputs = new Map<string, unknown>();
    const completedStepIds = new Set<string>();
    let interruptedStep: WorkflowStepRecord | undefined = undefined;

    for (const step of steps) {
      if (step.status === "COMPLETED") {
        completedStepOutputs.set(step.stepKey, step.output);
        completedStepIds.add(step.stepKey);
      } else if (step.status === "RUNNING") {
        // Step was actively running when process crashed
        interruptedStep = step;
      }
    }

    if (this.eventRepo && interruptedStep) {
      await this.eventRepo.create({
        runId,
        type: "run.recovered_interrupted_step",
        payload: {
          stepKey: interruptedStep.stepKey,
          attempt: interruptedStep.attempt,
        },
      });
    }

    const result: RecoveredRunState = {
      run,
      completedStepOutputs,
      completedStepIds,
      isAlreadyTerminal: false,
      ...(interruptedStep ? { interruptedStep } : {}),
    };

    return result;
  }
}
