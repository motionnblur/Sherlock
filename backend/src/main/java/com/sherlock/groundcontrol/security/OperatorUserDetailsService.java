package com.sherlock.groundcontrol.security;

import com.sherlock.groundcontrol.repository.OperatorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class OperatorUserDetailsService implements UserDetailsService {

    private final OperatorRepository operatorRepository;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        return operatorRepository.findByUsername(username)
                .map(OperatorUserDetails::new)
                .orElseThrow(() -> new UsernameNotFoundException("Operator not found: " + username));
    }
}
