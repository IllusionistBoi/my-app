import { useEffect } from 'react';
import { useRive, useStateMachineInput } from '@rive-app/react-canvas';
import riveFile from './animated_login_character.riv';

const RiveAnimation = ({ username, sessionName, sessionId, handleFailAnimation, handleSuccessAnimation, inputRef, setIsHandsUpInput }) => {
  const { rive, RiveComponent } = useRive({
    src: riveFile,
    stateMachines: 'Login Machine',
    autoplay: true,
  });

  const isCheckingInput = useStateMachineInput(rive, 'Login Machine', 'isChecking');
  const isHandsUpInput = useStateMachineInput(rive, 'Login Machine', 'isHandsUp');
  const numLookInput = useStateMachineInput(rive, 'Login Machine', 'numLook');
  const trigSuccessInput = useStateMachineInput(rive, 'Login Machine', 'trigSuccess');
  const trigFailInput = useStateMachineInput(rive, 'Login Machine', 'trigFail');
  const trigFailInputSessionId = useStateMachineInput(rive, 'Login Machine', 'trigFailInput');

  useEffect(() => {
    if (!username) {
      return;
    }

    if (isCheckingInput) {
      isCheckingInput.value = true;
    }

    if (numLookInput && inputRef.current) {
      const inputWidth = inputRef.current.offsetWidth || 100;
      const multiplier = inputWidth / 100;
      numLookInput.value = username.length * multiplier;
    }

    if (isHandsUpInput) {
      isHandsUpInput.value = false; // Reset after checking username
    }
  }, [username, isCheckingInput, isHandsUpInput, numLookInput, inputRef]);

  useEffect(() => {
    if (sessionName || sessionId) {
      isHandsUpInput.value = true; // Trigger hands-up when session details are present
    }
  }, [sessionName, sessionId, isHandsUpInput]);

  useEffect(() => {
    setIsHandsUpInput(isHandsUpInput); // Pass the input back to HomePage
  }, [isHandsUpInput, setIsHandsUpInput]);

  useEffect(() => {
    if (handleFailAnimation) {
      if (trigFailInput) {
        trigFailInput.fire();  // Fire only if trigFailInput exists
      }
      if (trigFailInputSessionId) {
        trigFailInputSessionId.fire();  // Fire only if trigFailInputSessionId exists
      }
    }
  }, [handleFailAnimation, trigFailInput, trigFailInputSessionId]);

  useEffect(() => {
    if (handleSuccessAnimation && trigSuccessInput) {
      trigSuccessInput.fire();
    }
  }, [handleSuccessAnimation, trigSuccessInput]);

  return <RiveComponent style={{ width: '500px', height: '500px' }} />;
};

export default RiveAnimation;
