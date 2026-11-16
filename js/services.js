
"use strict";

import {
    User,
    Project,
    Task,
    TaskFactory,
    Comment,
    ActivityLog
} from "./models.js";


export class EventBus {
    #listeners = new Map();

    subscribe(eventName, callback) {
        if (!this.#listeners.has(eventName)) {
            this.#listeners.set(eventName, new Set());
        }

        this.#listeners.get(eventName).add(callback);

        return () => {
            this.#listeners.get(eventName)?.delete(callback);
        };
    }

    publish(eventName, data) {
        this.#listeners.get(eventName)?.forEach(callback => {
            callback(data);
        });
    }
}


export class StorageService {
    static STORAGE_KEY = "taskflow-data";

    static save(data) {
        localStorage.setItem(
            StorageService.STORAGE_KEY,
            JSON.stringify(data)
        );
    }

    static load() {
        try {
            const storedData = localStorage.getItem(
                StorageService.STORAGE_KEY
            );

            return storedData ? JSON.parse(storedData) : null;
        } catch (error) {
            console.error("Unable to read saved data:", error);
            return null;
        }
    }

    static clear() {
        localStorage.removeItem(StorageService.STORAGE_KEY);
    }
}


export class ProjectService {
    #projects = [];
    #tasks = [];
    #users = [];
    #eventBus;

    constructor(eventBus) {
        this.#eventBus = eventBus;
    }

    get projects() {
        return [...this.#projects];
    }

    get tasks() {
        return [...this.#tasks];
    }

    get users() {
        return [...this.#users];
    }

    initialize() {
        const savedData = StorageService.load();

        if (savedData) {
            this.#restoreData(savedData);
        } else {
            this.#createSampleData();
            this.save();
        }

        this.#eventBus.publish("data:loaded", this.getApplicationData());
    }

    #restoreData(data) {
        this.#users = data.users.map(user => new User(user));

        const userMap = new Map(
            this.#users.map(user => [user.id, user])
        );

        this.#projects = data.projects.map(projectData => {
            const project = new Project({
                ...projectData,
                members: projectData.members
                    .map(id => userMap.get(id))
                    .filter(Boolean)
            });

            return project;
        });

        const projectMap = new Map(
            this.#projects.map(project => [project.id, project])
        );

        this.#tasks = data.tasks.map(taskData => {
            const task = TaskFactory.create(taskData.type, {
                ...taskData,
                assignees: (taskData.assignees || [])
                    .map(id => userMap.get(id))
                    .filter(Boolean),
                comments: taskData.comments || [],
                attachments: taskData.attachments || [],
                activityLog: taskData.activityLog || []
            });
            

            projectMap.get(task.projectId)?.addTask(task);

            return task;
        });
    }

    #createSampleData() {
        const bilal = new User({
            id: "USER-1",
            name: "Bilal Majid",
            role: "Frontend Developer",
            initials: "BM",
            color: "purple"
        });

        const ali = new User({
            id: "USER-2",
            name: "Ali Ahmed",
            role: "Backend Developer",
            initials: "AA",
            color: "blue"
        });

        const sara = new User({
            id: "USER-3",
            name: "Sara Khan",
            role: "UI/UX Designer",
            initials: "SK",
            color: "pink"
        });

        const hamza = new User({
            id: "USER-4",
            name: "Hamza Malik",
            role: "QA Engineer",
            initials: "HM",
            color: "orange"
        });

        this.#users = [bilal, ali, sara, hamza];

        const projectOne = new Project({
            id: "PROJECT-1",
            title: "Website Redesign",
            description: "Redesign the company website and improve its user experience.",
            startDate: "2026-11-01",
            dueDate: "2026-12-15",
            members: [bilal, sara, ali]
        });

        const projectTwo = new Project({
            id: "PROJECT-2",
            title: "Mobile Application",
            description: "Develop a responsive mobile application.",
            startDate: "2026-11-05",
            dueDate: "2026-12-20",
            members: [bilal, hamza, ali]
        });

        const projectThree = new Project({
            id: "PROJECT-3",
            title: "Documentation Portal",
            description: "Create technical documentation and project guides.",
            startDate: "2026-11-10",
            dueDate: "2026-12-10",
            members: [sara, bilal]
        });

        this.#projects = [projectOne, projectTwo, projectThree];

        const sampleTasks = [
            {
                id: "TASK-1",
                type: "development",
                title: "Build responsive navigation",
                description: "Create the responsive navigation bar for all screen sizes.",
                priority: "high",
                status: "in-progress",
                dueDate: "2026-11-22",
                estimatedHours: 8,
                projectId: projectOne.id,
                assignees: [bilal, sara],
                technology: "JavaScript"
            },
            {
                id: "TASK-2",
                type: "development",
                title: "Create homepage layout",
                description: "Develop the homepage sections and responsive layout.",
                priority: "medium",
                status: "todo",
                dueDate: "2026-11-25",
                estimatedHours: 12,
                projectId: projectOne.id,
                assignees: [bilal],
                technology: "CSS"
            },
            {
                id: "TASK-3",
                type: "testing",
                title: "Test login functionality",
                description: "Test login form validation and authentication flow.",
                priority: "high",
                status: "completed",
                dueDate: "2026-11-12",
                estimatedHours: 5,
                projectId: projectTwo.id,
                assignees: [hamza],
                testEnvironment: "Chrome"
            },
            {
                id: "TASK-4",
                type: "development",
                title: "Build API integration",
                description: "Connect the application with the required API endpoints.",
                priority: "high",
                status: "in-progress",
                dueDate: "2026-11-28",
                estimatedHours: 10,
                projectId: projectTwo.id,
                assignees: [ali],
                technology: "JavaScript"
            },
            {
                id: "TASK-5",
                type: "documentation",
                title: "Write installation guide",
                description: "Prepare a guide explaining how to install and run the application.",
                priority: "low",
                status: "todo",
                dueDate: "2026-12-01",
                estimatedHours: 4,
                projectId: projectThree.id,
                assignees: [sara],
                documentFormat: "Markdown"
            },
            {
                id: "TASK-6",
                type: "testing",
                title: "Responsive layout testing",
                description: "Test the website on mobile, tablet, and desktop screens.",
                priority: "medium",
                status: "todo",
                dueDate: "2026-11-14",
                estimatedHours: 6,
                projectId: projectOne.id,
                assignees: [hamza],
                testEnvironment: "Multiple browsers"
            }
        ];

        this.#tasks = sampleTasks.map(data => {
            const task = TaskFactory.create(data.type, data);

            const initialAssignees = task.assignees;

            initialAssignees.forEach(user => {
                task.addActivity(
                    "assignment",
                    `${user.name} was assigned to "${task.title}".`
                );
            });

            this.#projects
                .find(project => project.id === task.projectId)
                .addTask(task);

            return task;
        });

        const comment = new Comment({
            user: "Bilal Majid",
            text: "Initial task setup completed."
        });

        this.#tasks[0].addComment(comment);
    }

    getApplicationData() {
        return {
            projects: this.projects,
            tasks: this.tasks,
            users: this.users
        };
    }

    getProject(projectId) {
        return this.#projects.find(project => project.id === projectId);
    }

    getTask(taskId) {
        return this.#tasks.find(task => task.id === taskId);
    }

    addProject(data) {
        if (!data.title?.trim()) {
            throw new Error("Project title is required.");
        }

        const project = new Project({
            ...data,
            members: []
        });

        this.#projects.push(project);
        this.save();

        this.#eventBus.publish("project:changed", project);

        return project;
    }

    addTask(data) {
        const project = this.getProject(data.projectId);

        if (!project) {
            throw new Error("Please select a valid project.");
        }

        if (!data.title?.trim()) {
            throw new Error("Task title is required.");
        }

        const hours = Number(data.estimatedHours);

        if (!Number.isFinite(hours) || hours <= 0) {
            throw new Error("Estimated hours must be greater than zero.");
        }

        const assignees = (data.assigneeIds || [])
            .map(id => this.#users.find(user => user.id === id))
            .filter(Boolean);

        const task = TaskFactory.create(data.type, {
            ...data,
            title: data.title.trim(),
            estimatedHours: hours,
            assignees
        });

        assignees.forEach(user => {
            task.addActivity(
                "assignment",
                `${user.name} was assigned to "${task.title}".`
            );
        });

        project.addTask(task);
        this.#tasks.push(task);

        this.save();
        this.#eventBus.publish("task:created", task);

        return task;
    }

    updateTask(taskId, data) {
        const task = this.getTask(taskId);

        if (!task) {
            throw new Error("Task not found.");
        }

        if (data.projectId && data.projectId !== task.projectId) {
            const oldProject = this.getProject(task.projectId);
            const newProject = this.getProject(data.projectId);

            if (!newProject) {
                throw new Error("Target project does not exist.");
            }

            oldProject.removeTask(task.id);
            task.projectId = newProject.id;
            newProject.addTask(task);
        }

        const { assigneeIds, type, projectId, ...taskData } = data;

        task.update(taskData);

        if (assigneeIds) {
            const selectedUsers = assigneeIds
                .map(id => this.#users.find(user => user.id === id))
                .filter(Boolean);

            task.assignees.forEach(user => {
                if (!selectedUsers.some(selected => selected.id === user.id)) {
                    task.removeAssignee(user.id);
                }
            });

            selectedUsers.forEach(user => task.assignTo(user));
        }

        this.save();
        this.#eventBus.publish("task:updated", task);

        return task;
    }

    deleteTask(taskId) {
        const task = this.getTask(taskId);

        if (!task) {
            throw new Error("Task not found.");
        }

        this.getProject(task.projectId)?.removeTask(taskId);

        this.#tasks = this.#tasks.filter(item => item.id !== taskId);

        this.save();
        this.#eventBus.publish("task:deleted", taskId);
    }

    assignTask(taskId, userId) {
        const task = this.getTask(taskId);
        const user = this.#users.find(item => item.id === userId);

        if (!task || !user) {
            throw new Error("Task or user not found.");
        }

        task.assignTo(user);

        this.save();
        this.#eventBus.publish("task:updated", task);

        return task;
    }

    removeAssignee(taskId, userId) {
        const task = this.getTask(taskId);

        if (!task) {
            throw new Error("Task not found.");
        }

        task.removeAssignee(userId);

        this.save();
        this.#eventBus.publish("task:updated", task);
    }

    completeTask(taskId) {
        const task = this.getTask(taskId);

        if (!task) {
            throw new Error("Task not found.");
        }

        task.complete();

        this.save();
        this.#eventBus.publish("task:updated", task);
    }

    reopenTask(taskId) {
        const task = this.getTask(taskId);

        if (!task) {
            throw new Error("Task not found.");
        }

        task.reopen();

        this.save();
        this.#eventBus.publish("task:updated", task);
    }

    duplicateTask(taskId) {
        const original = this.getTask(taskId);

        if (!original) {
            throw new Error("Task not found.");
        }

        const duplicate = original.duplicate();

        this.getProject(original.projectId).addTask(duplicate);
        this.#tasks.push(duplicate);

        duplicate.addActivity(
            "created",
            `A copy of "${original.title}" was created.`
        );

        this.save();
        this.#eventBus.publish("task:created", duplicate);

        return duplicate;
    }

    addComment(taskId, text, userName = "Bilal Majid") {
        const task = this.getTask(taskId);

        if (!task) {
            throw new Error("Task not found.");
        }

        if (!text.trim()) {
            throw new Error("Comment cannot be empty.");
        }

        task.addComment(new Comment({
            user: userName,
            text: text.trim()
        }));

        this.save();
        this.#eventBus.publish("task:updated", task);
    }

    searchTasks(filters = {}) {
        const {
            search = "",
            status = "all",
            priority = "all",
            projectId = "all",
            userId = "all"
        } = filters;

        const query = search.toLowerCase().trim();

        return this.#tasks.filter(task => {
            const matchesSearch =
                !query ||
                task.title.toLowerCase().includes(query) ||
                task.description.toLowerCase().includes(query);

            const matchesStatus =
                status === "all" || task.status === status;

            const matchesPriority =
                priority === "all" || task.priority === priority;

            const matchesProject =
                projectId === "all" || task.projectId === projectId;

            const matchesUser =
                userId === "all" ||
                task.assignees.some(user => user.id === userId);

            return (
                matchesSearch &&
                matchesStatus &&
                matchesPriority &&
                matchesProject &&
                matchesUser
            );
        });
    }

    getSummary() {
        return Task.calculateSummary(this.#tasks);
    }

    save() {
        StorageService.save({
            users: this.#users,
            projects: this.#projects.map(project => project.toJSON()),
            tasks: this.#tasks.map(task => task.toJSON())
        });
    }

    resetData() {
        StorageService.clear();

        this.#projects = [];
        this.#tasks = [];
        this.#users = [];

        this.#createSampleData();
        this.save();

        this.#eventBus.publish("data:loaded", this.getApplicationData());
    }
}


export const TaskUtilities = {
    formatTitle(prefix, suffix) {
        return `${prefix}${this.title}${suffix}`;
    },

    calculateTotalHours(tasks) {
        return tasks.reduce((total, task) => total + task.estimatedHours, 0);
    },

    demonstrateBinding(task, tasks) {
        const usingCall = this.formatTitle.call(task, "[", "]");

        const usingApply = this.calculateTotalHours.apply(this, [tasks]);

        const boundFormatter = this.formatTitle.bind(task, "Task: ");

        const usingBind = boundFormatter("!");

        return {
            usingCall,
            usingApply,
            usingBind
        };
    }
};
