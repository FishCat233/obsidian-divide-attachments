import { App, Editor, MarkdownView, Modal, normalizePath, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile } from 'obsidian';

// Remember to rename these classes and interfaces!

interface PluginSettings {
	publicFolder: string,
	publicAttachmentFolder: string,
}

const DEFAULT_SETTINGS: PluginSettings = {
	publicFolder: 'public',
	publicAttachmentFolder: 'public/attachments'
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'];

export default class DivideAttachmentsPlugin extends Plugin {
	settings: PluginSettings;

	async onload() {
		await this.loadSettings();

		this.registerEvent(this.app.vault.on('create', this.handleFileCreation))

		// 加设置
		this.addSettingTab(new SampleSettingTab(this.app, this));

	}

	handleFileCreation = async (file: TAbstractFile) => {
		// 确保处理的是 TFile 实例，而不是 TFolder
		if (!(file instanceof TFile)) {
			return;
		}

		const newAttachment = file as TFile;

		// 1. 检查文件是否是图片/附件
		if (!IMAGE_EXTENSIONS.includes(newAttachment.extension.toLowerCase())) {
			// 不是我们关心的附件类型，忽略
			return;
		}

		// 2. 获取当前活动的笔记
		// 理论上，图片是在当前活动的笔记中粘贴或拖放的
		const activeFile = this.app.workspace.getActiveFile();

		if (!activeFile) {
			// 没有活动的笔记，无法判断上下文，保持原位
			return;
		}

		// 3. 检查当前活动笔记的路径是否在 'public/' 目录下
		const notePath = activeFile.path;

		// 检查笔记路径是否以 'public/' 开头
		const isPublicNote = notePath.startsWith(this.settings.publicFolder + '/');

		if (!isPublicNote) {
			// 笔记不在 public/ 目录下，保持原位
			return;
		}

		// 4. 判断附件是否已经在目标文件夹中
		// 这一步是为了防止Obsidian的全局设置恰好设置为 public/attachments/
		const isAlreadyInTarget = newAttachment.path.startsWith(normalizePath(this.settings.publicAttachmentFolder) + '/')

		if (isAlreadyInTarget) {
			// 附件已经在目标路径，不需要移动
			return;
		}

		// 5. 构造新的目标路径
		const vault = this.app.vault;
		const newFileName = newAttachment.name;

		// 确保目标文件夹存在
		await vault.createFolder(this.settings.publicAttachmentFolder).catch(() => {
			// 如果文件夹已存在，createFolder会失败，这是正常的，忽略错误
		});

		// 组合新的完整路径: public/attachments/新文件名
		const newPath = normalizePath(`${this.settings.publicAttachmentFolder}/${newFileName}`);

		// 6. 移动文件
		try {
			// 使用 app.fileManager.renameFile 而不是 app.vault.rename
			// app.fileManager.renameFile 会自动更新所有引用该附件的链接
			await this.app.fileManager.renameFile(newAttachment, newPath);

			// 可选：发送通知
			new Notice(`已将附件 ${newFileName} 移动到 ${this.settings.publicAttachmentFolder}`);

		} catch (error) {
			console.error('移动附件失败:', error);
			new Notice(`移动附件 ${newFileName} 失败。可能已存在同名文件。`);
		}
	}
	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: DivideAttachmentsPlugin;

	constructor(app: App, plugin: DivideAttachmentsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}
	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl('h2', { text: '附件分类设置' });

		new Setting(containerEl)
			.setName('公开文件夹')
			.setDesc('存放公开内容的文件夹名称')
			.addText(text => text
				.setPlaceholder('输入文件夹名称')
				.setValue(this.plugin.settings.publicFolder)
				.onChange(async (value) => {
					this.plugin.settings.publicFolder = value;
					// 更新公开附件文件夹路径
					this.plugin.settings.publicAttachmentFolder = `${value}/attachments`;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('公开附件文件夹')
			.setDesc('在公开文件夹内存放附件的子文件夹路径')
			.addText(text => text
				.setPlaceholder('输入公开中子文件夹的路径，如：images或assets/images')
				.setValue(this.plugin.settings.publicAttachmentFolder)
				.onChange(async (value) => {
					this.plugin.settings.publicAttachmentFolder = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('p', { text: '插件说明：当您在公开文件夹下的笔记中插入图片时，插件会自动将图片移动到公开附件文件夹中，以便于发布到网站。', cls: 'setting-item-description' });
	}
}