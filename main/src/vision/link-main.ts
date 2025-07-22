import { Worker } from 'worker_threads'
import * as Comlink from 'comlink'
import nodeEndpoint from 'comlink/dist/umd/node-adapter'
import type { WorkerAPI } from './link-worker'
import type { ImageData } from './utils'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { Logger } from '../RemoteLogger'

export class OcrWorker {
  // Use development path in dev mode, user app data in production
  private binDir = app.isPackaged 
    ? path.join(app.getPath('userData'), 'apt-data/cv-ocr')
    : path.join(__dirname, '..', 'cv-ocr')
  private api: Comlink.Remote<WorkerAPI>
  private lang = ''

  private constructor (logger: Logger) {
    const worker = new Worker(__dirname + '/vision.js')
    this.api = Comlink.wrap<WorkerAPI>(nodeEndpoint(worker))
  }

  static async create (logger: Logger) {
    const worker = new OcrWorker(logger)
    try {
      // Verify opencv.js exists before initializing
      logger.write(`OcrWorker initialization started`)
      const opencvPath = path.join(worker.binDir, 'opencv.js')
      logger.write(`OcrWorker initialization: OpenCV file exists: ${fs.existsSync(opencvPath)}`)

      // log current directory
      logger.write(`OcrWorker initialization: Current directory: ${process.cwd()}`)

      if (!fs.existsSync(opencvPath)) {
        throw new Error(`OpenCV file not found at: ${opencvPath}\nPlease ensure cv-ocr folder is in the correct location`)
      }
      
      await worker.api.init(worker.binDir)
    } catch (error) {
      logger.write(`OcrWorker initialization failed: ${error}`)
      console.log(`OcrWorker initialization failed: ${error}`)
      // Don't throw - let it continue with limited functionality
    }
    return worker
  }

  async updateOptions (lang: string) {
    try {
      if (lang !== this.lang) {
        await this.api.changeLanguage(lang, this.binDir)
      }
    } catch {} finally {
      this.lang = lang
    }
  }

  async findHeistGems (image: ImageData) {
    const result = await this.api.findHeistGems(
      Comlink.transfer(image, [image.data.buffer]))
    return result
  }

  async readItemColors (
    image: ImageData, 
    mouseX?: number, 
    mouseY?: number,
    customThresholds?: {
      matched: { saturation: number; value: number };
      unmatched: { saturation: number; value: number };
    }
  ) {
    // clone the image
    const clone = {
      ...image,
      data: new Uint8Array(image.data)
    }
    const result = await this.api.readItemColors(
      Comlink.transfer(clone, [clone.data.buffer]), mouseX, mouseY, customThresholds)
    return result
  }
}
  