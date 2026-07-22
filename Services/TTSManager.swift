import Foundation
import AVFoundation
import Combine

/// ???????????
public enum TTSPlaybackState {
    case stopped
    case playing
    case paused
}

/// ????????????? (TTS) ????????
public class TTSManager: NSObject, ObservableObject, AVSpeechSynthesizerDelegate {
    public static let shared = TTSManager()

    private let synthesizer = AVSpeechSynthesizer()

    @Published public var state: TTSPlaybackState = .stopped
    @Published public var currentLineIndex: Int = 0
    @Published public var currentScript: Script?
    @Published public var currentLineText: String = ""

    // ??????????????????
    @Published public var selectedVoiceIdentifier: String = ""

    // rateMultiplier ???? 0.5x ~ 2.0x??.0x ???? AVSpeechUtteranceMaximumSpeechRate (1.0)
    @Published public var rateMultiplier: Float = 1.0 {
        didSet {
            let calculatedRate = rateMultiplier * AVSpeechUtteranceDefaultSpeechRate
            self.rate = min(AVSpeechUtteranceMaximumSpeechRate, max(AVSpeechUtteranceMinimumSpeechRate, calculatedRate))
        }
    }
    @Published public var rate: Float = AVSpeechUtteranceDefaultSpeechRate
    @Published public var pitch: Float = 1.0
    @Published public var volume: Float = 1.0

    private var isPreviewing = false
    // ??????????????    
private var pauseWorkItem: DispatchWorkItem?

    override private init() {
        super.init()
        synthesizer.delegate = self
        setupAudioSession()
        setDefaultVoice()
        let settings = DataManager.shared.settings
        if !settings.defaultVoiceIdentifier.isEmpty {
            selectedVoiceIdentifier = settings.defaultVoiceIdentifier
        }
        rateMultiplier = settings.defaultRate > 0 ? settings.defaultRate : 1.0
        pitch = settings.defaultPitch
    }

    // MARK: - ??????????????????

    private func setupAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers, .mixWithOthers])
            try session.setActive(true)
        } catch {
            print("AVAudioSession ????????????????: \(error.localizedDescription)")
        }
    }

    private func setDefaultVoice() {
        let currentLang = Locale.current.language.languageCode?.identifier ?? "zh"
        let voices = AVSpeechSynthesisVoice.speechVoices()
        if let match = voices.first(where: { $0.language.contains(currentLang) || $0.language.contains("zh") || $0.language.contains("en") }) {
            selectedVoiceIdentifier = match.identifier
        }
    }

    public func availableVoices() -> [AVSpeechSynthesisVoice] {
        return AVSpeechSynthesisVoice.speechVoices().sorted { $0.language < $1.language }
    }

    // MARK: - ???????? API

    /// ???????????????????????????????????謏??????????????????????授?????????????????    
public func loadScript(_ script: Script, startAtIndex index: Int = 0) {
        stop()
        self.currentScript = script
        self.currentLineIndex = min(max(0, index), max(0, script.lines.count - 1))
        updateCurrentLineText()
    }

    /// ???????????????????????????????????    
public func playCurrentLine() {
        guard let script = currentScript, !script.lines.isEmpty else { return }
        let lines = script.sortedLines
        guard currentLineIndex >= 0 && currentLineIndex < lines.count else { return }

        let line = lines[currentLineIndex]
        speakLine(line)
    }


    public func preview(text: String) {
        stop()
        isPreviewing = true
        guard !text.isEmpty else { return }
        let utterance = makeUtterance(text: text)
        state = .playing
        synthesizer.speak(utterance)
    }



    public func speakLine(_ line: ScriptLine) {
        isPreviewing = false
        pauseWorkItem?.cancel()
        if synthesizer.isSpeaking {
            synthesizer.stopSpeaking(at: .immediate)
        }

        guard !line.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            // ???????????????????            self.nextLine()
            return
        }

        currentLineText = line.text
        let utterance = makeUtterance(text: line.text)

        // ??????
        if line.pauseBeforeMs > 0 {
            let delay = Double(line.pauseBeforeMs) / 1000.0
            let item = DispatchWorkItem { [weak self] in
                self?.state = .playing
                self?.synthesizer.speak(utterance)
            }
            self.pauseWorkItem = item
            DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: item)
        } else {
            state = .playing
            synthesizer.speak(utterance)
        }
    }

    /// ???????????????/ ?????    
public func replayCurrentLine() {
        playCurrentLine()
    }

    /// ?????????????????????
    public func nextLine() {
        guard let script = currentScript else { return }
        let count = script.lines.count
        if currentLineIndex + 1 < count {
            currentLineIndex += 1
            updateCurrentLineText()
            playCurrentLine()
        } else {
            stop()
        }
    }

    /// ?????????????????????
    public func previousLine() {
        guard currentScript != nil else { return }
        if currentLineIndex - 1 >= 0 {
            currentLineIndex -= 1
            updateCurrentLineText()
            playCurrentLine()
        }
    }

    /// ???????
    public func pause() {
        pauseWorkItem?.cancel()
        if synthesizer.isSpeaking {
            synthesizer.pauseSpeaking(at: .immediate)
            state = .paused
        }
    }

    /// ?????????
    public func resume() {
        if synthesizer.isPaused {
            synthesizer.continueSpeaking()
            state = .playing
        } else {
            playCurrentLine()
        }
    }

    /// ??????????????????????
    public func stop() {
        isPreviewing = false
        pauseWorkItem?.cancel()
        if synthesizer.isSpeaking || synthesizer.isPaused {
            synthesizer.stopSpeaking(at: .immediate)
        }
        state = .stopped
    }

    // MARK: - ????????????????

    private func makeUtterance(text: String) -> AVSpeechUtterance {
        let utterance = AVSpeechUtterance(string: text)
        utterance.rate = rate
        utterance.pitchMultiplier = pitch
        utterance.volume = volume

        if !selectedVoiceIdentifier.isEmpty, let voice = AVSpeechSynthesisVoice(identifier: selectedVoiceIdentifier) {
            utterance.voice = voice
        } else {
            utterance.voice = AVSpeechSynthesisVoice(language: Locale.current.identifier)
        }

        return utterance
    }

    private func updateCurrentLineText() {
        guard let script = currentScript else {
            currentLineText = ""
            return
        }
        let lines = script.sortedLines
        if currentLineIndex >= 0 && currentLineIndex < lines.count {
            currentLineText = lines[currentLineIndex].text
        } else {
            currentLineText = ""
        }
    }

    // MARK: - AVSpeechSynthesizerDelegate

    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            if self.isPreviewing {
                self.isPreviewing = false
                self.state = .stopped
                return
            }

            guard let script = self.currentScript else {
                self.state = .stopped
                return
            }

            let lines = script.sortedLines
            guard self.currentLineIndex >= 0 && self.currentLineIndex < lines.count else {
                self.state = .stopped
                return
            }

            let currentLine = lines[self.currentLineIndex]
            let pauseAfter = currentLine.pauseAfterMs

            // ????????????????????????
            if pauseAfter > 0 {
                let delay = Double(pauseAfter) / 1000.0
                let item = DispatchWorkItem { [weak self] in
                    self?.handlePostSpeechAdvance()
                }
                self.pauseWorkItem = item
                DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: item)
            } else {
                self.handlePostSpeechAdvance()
            }
        }
    }

    private func handlePostSpeechAdvance() {
        nextLine()
    }

    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.isPreviewing = false
            self.state = .stopped
        }
    }
}