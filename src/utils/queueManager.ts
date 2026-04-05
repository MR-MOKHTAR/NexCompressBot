export type TaskDefinition = {
  execute: () => Promise<void>;
};

class QueueManager {
  private queue: TaskDefinition[] = [];
  private isProcessing = false;

  public async enqueue(task: TaskDefinition) {
    this.queue.push(task);
    this.processQueue();
  }

  public getQueueLength() {
    return this.queue.length;
  }

  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
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
