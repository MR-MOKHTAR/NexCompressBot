export type TaskDefinition = {
  userId: number;
  operationType: "compress" | "convert" | "trim";
  execute: () => Promise<void>;
  onProgress?: (percent: number) => void;
};

class QueueManager {
  private queue: TaskDefinition[] = [];
  private isProcessing = false;
  private lastProcessedUserId: number | null = null;

  public async enqueue(task: TaskDefinition) {
    this.queue.push(task);
    this.processQueue();
  }

  public getQueueLength() {
    return this.queue.length;
  }

  private findNextTask(): TaskDefinition | null {
    if (this.queue.length === 0) return null;

    // Try to find a task from a different user than the last one
    if (this.lastProcessedUserId !== null) {
      for (let i = 0; i < this.queue.length; i++) {
        if (this.queue[i].userId !== this.lastProcessedUserId) {
          const task = this.queue[i];
          this.queue.splice(i, 1);
          return task;
        }
      }
    }

    // If no task from different user found (or lastProcessedUserId is null),
    // just take the first task
    return this.queue.shift() || null;
  }

  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.findNextTask();
      if (task) {
        this.lastProcessedUserId = task.userId;
        try {
          await task.execute();
        } catch (error) {
          console.error("Task failed in queue", error);
        }

        // 5 seconds delay after each task
        if (this.queue.length > 0) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    }

    this.isProcessing = false;
  }
}

export const processingQueue = new QueueManager();
